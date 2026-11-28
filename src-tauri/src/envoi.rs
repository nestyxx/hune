//! Envois sortants de Hune : e-mail (SMTP), SMS OVH, requêtes HTTP génériques (ntfy, Telegram, Discord, Brevo, OpenRouter…)
//! et coffre de secrets.
//!
//! Les secrets (mot de passe SMTP, jetons, clés d'API) sont rangés dans le coffre du système (Gestionnaire d'identifiants
//! de Windows, Trousseau sur macOS), JAMAIS dans `hune.json` : ce fichier est exporté, sauvegardé et synchronisé.
//! L'interface peut écrire un secret mais jamais le relire : elle ne fait que le référencer par son nom, sous la forme
//! `{{secret:nom}}` dans l'URL, les en-têtes ou le corps d'une requête, et c'est ici, côté Rust, qu'il est substitué.

use serde::{Deserialize, Serialize};
use std::time::Duration;

const SERVICE: &str = "io.github.nestyxx.hune";
/// Taille maximale d'une réponse HTTP renvoyée à l'interface.
const REPONSE_MAX: usize = 256 * 1024;

fn nom_valide(nom: &str) -> bool {
    !nom.is_empty() && nom.len() <= 40 && nom.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[cfg(any(windows, target_os = "macos"))]
fn entree(nom: &str) -> Result<keyring::Entry, String> {
    if !nom_valide(nom) {
        return Err("Nom de secret invalide".into());
    }
    keyring::Entry::new(SERVICE, nom).map_err(|e| e.to_string())
}

#[cfg(any(windows, target_os = "macos"))]
fn secret_lire(nom: &str) -> Option<String> {
    entree(nom).ok()?.get_password().ok().filter(|s| !s.is_empty())
}

#[cfg(not(any(windows, target_os = "macos")))]
fn secret_lire(_nom: &str) -> Option<String> {
    None
}

/// Range un secret dans le coffre du système. Une valeur vide efface le secret.
#[tauri::command]
pub fn secret_definir(nom: String, valeur: String) -> Result<(), String> {
    #[cfg(any(windows, target_os = "macos"))]
    {
        let e = entree(&nom)?;
        if valeur.is_empty() {
            return match e.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
                Err(err) => Err(err.to_string()),
            };
        }
        e.set_password(&valeur).map_err(|e| e.to_string())
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = (nom, valeur);
        Err("Coffre de secrets non pris en charge sur ce système".into())
    }
}

/// Un secret existe-t-il ? (sa valeur n'est jamais renvoyée)
#[tauri::command]
pub fn secret_existe(nom: String) -> bool {
    secret_lire(&nom).is_some()
}

/// Remplace chaque `{{secret:nom}}` par la valeur du coffre. Échoue (sans rien révéler) si un secret manque.
fn substituer(texte: &str) -> Result<String, String> {
    const DEBUT: &str = "{{secret:";
    let mut sortie = String::with_capacity(texte.len());
    let mut reste = texte;
    while let Some(i) = reste.find(DEBUT) {
        sortie.push_str(&reste[..i]);
        let apres = &reste[i + DEBUT.len()..];
        let Some(fin) = apres.find("}}") else { return Err("Marqueur de secret mal formé".into()) };
        let nom = &apres[..fin];
        let valeur = secret_lire(nom).ok_or_else(|| format!("Secret « {nom} » non renseigné (Réglages › Notifications)."))?;
        sortie.push_str(&valeur);
        reste = &apres[fin + 2..];
    }
    sortie.push_str(reste);
    Ok(sortie)
}

#[derive(Deserialize)]
pub struct Requete {
    methode: String,
    url: String,
    #[serde(default)]
    entetes: Vec<(String, String)>,
    corps: Option<String>,
    /// Délai maximal en secondes (20 par défaut).
    delai_s: Option<u64>,
}

#[derive(Serialize)]
pub struct Reponse {
    statut: u16,
    corps: String,
}

fn client(delai_s: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(delai_s.clamp(3, 120)))
        // Pas de redirection : un en-tête d'authentification ne doit jamais suivre vers un autre hôte.
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("Hune")
        .build()
        .map_err(|e| e.to_string())
}

fn tronquer(mut texte: String) -> String {
    if texte.len() > REPONSE_MAX {
        let mut n = REPONSE_MAX;
        while !texte.is_char_boundary(n) {
            n -= 1;
        }
        texte.truncate(n);
    }
    texte
}

/// Requête HTTP(S) sortante. Les erreurs ne reprennent jamais l'URL (elle peut contenir un jeton).
#[tauri::command]
pub async fn http_requete(requete: Requete) -> Result<Reponse, String> {
    let url = substituer(&requete.url)?;
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Seules les adresses http(s) sont acceptées".into());
    }
    let methode = reqwest::Method::from_bytes(requete.methode.to_uppercase().as_bytes()).map_err(|_| "Méthode HTTP invalide".to_string())?;
    let mut r = client(requete.delai_s.unwrap_or(20))?.request(methode, &url);
    for (nom, valeur) in &requete.entetes {
        r = r.header(nom.as_str(), substituer(valeur)?);
    }
    if let Some(corps) = &requete.corps {
        r = r.body(substituer(corps)?);
    }
    let reponse = r.send().await.map_err(|e| e.without_url().to_string())?;
    let statut = reponse.status().as_u16();
    let corps = reponse.text().await.map_err(|e| e.without_url().to_string())?;
    Ok(Reponse { statut, corps: tronquer(corps) })
}

#[derive(Deserialize)]
pub struct Mail {
    serveur: String,
    port: u16,
    /// « ssl » (port 465), « starttls » (587) ou « aucune ».
    securite: String,
    utilisateur: String,
    expediteur: String,
    destinataires: Vec<String>,
    sujet: String,
    texte: String,
    html: Option<String>,
}

fn envoyer_mail_bloquant(m: Mail) -> Result<(), String> {
    use lettre::message::{header::ContentType, Mailbox, MultiPart, SinglePart};
    use lettre::transport::smtp::authentication::Credentials;
    use lettre::{Message, SmtpTransport, Transport};

    if m.destinataires.is_empty() {
        return Err("Aucun destinataire".into());
    }
    let expediteur: Mailbox = m.expediteur.parse().map_err(|_| "Adresse d'expéditeur invalide".to_string())?;
    let mut message = Message::builder().from(expediteur).subject(m.sujet);
    for d in &m.destinataires {
        message = message.to(d.trim().parse().map_err(|_| format!("Adresse de destinataire invalide : {d}"))?);
    }
    let message = match &m.html {
        Some(html) => message.multipart(MultiPart::alternative_plain_html(m.texte.clone(), html.clone())),
        None => message.singlepart(SinglePart::builder().header(ContentType::TEXT_PLAIN).body(m.texte.clone())),
    }
    .map_err(|e| e.to_string())?;

    let constructeur = match m.securite.as_str() {
        "ssl" => SmtpTransport::relay(&m.serveur),
        "starttls" => SmtpTransport::starttls_relay(&m.serveur),
        _ => Ok(SmtpTransport::builder_dangerous(&m.serveur)),
    }
    .map_err(|e| e.to_string())?;
    let mut constructeur = constructeur.port(m.port).timeout(Some(Duration::from_secs(25)));
    if !m.utilisateur.is_empty() {
        let mdp = secret_lire("smtp").ok_or("Mot de passe SMTP non renseigné")?;
        constructeur = constructeur.credentials(Credentials::new(m.utilisateur, mdp));
    }
    constructeur.build().send(&message).map(|_| ()).map_err(|e| e.to_string())
}

/// Envoie un e-mail par le serveur SMTP configuré (mot de passe lu dans le coffre, secret « smtp »).
#[tauri::command]
pub async fn envoyer_mail(mail: Mail) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || envoyer_mail_bloquant(mail)).await.map_err(|e| e.to_string())?
}

#[derive(Deserialize)]
pub struct SmsOvh {
    /// « eu » ou « ca ».
    region: String,
    cle_application: String,
    /// Identifiant du compte SMS, du type « sms-ab123456-1 ».
    service: String,
    expediteur: Option<String>,
    destinataires: Vec<String>,
    message: String,
}

/// Signature d'une requête de l'API OVH : « $1$ » + SHA-1 de « secret+consumer+méthode+url+corps+horodatage ».
fn signature_ovh(secret: &str, consommateur: &str, methode: &str, url: &str, corps: &str, horodatage: &str) -> String {
    use sha1::{Digest, Sha1};
    let brut = format!("{secret}+{consommateur}+{methode}+{url}+{corps}+{horodatage}");
    let empreinte = Sha1::digest(brut.as_bytes());
    let hex: String = empreinte.iter().map(|o| format!("{o:02x}")).collect();
    format!("$1${hex}")
}

/// Envoie un SMS par l'API OVH (`POST /sms/{service}/jobs`). Secrets lus dans le coffre : « ovh-secret » et « ovh-consumer ».
#[tauri::command]
pub async fn envoyer_sms_ovh(sms: SmsOvh) -> Result<String, String> {
    let base = match sms.region.as_str() {
        "ca" => "https://ca.api.ovh.com/1.0",
        _ => "https://eu.api.ovh.com/1.0",
    };
    if !sms.service.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.') || sms.service.is_empty() {
        return Err("Identifiant de service SMS invalide".into());
    }
    let secret = secret_lire("ovh-secret").ok_or("Secret d'application OVH non renseigné")?;
    let consommateur = secret_lire("ovh-consumer").ok_or("Consumer key OVH non renseignée")?;
    let c = client(20)?;
    // L'horodatage signé doit être celui du serveur OVH.
    let horodatage = c.get(format!("{base}/auth/time")).send().await.map_err(|e| e.without_url().to_string())?.text().await.map_err(|e| e.without_url().to_string())?;
    let horodatage = horodatage.trim().to_string();
    let url = format!("{base}/sms/{}/jobs", sms.service);
    let mut corps = serde_json::json!({
        "message": sms.message,
        "receivers": sms.destinataires,
        "noStopClause": true,
        "priority": "high",
        "coding": "7bit",
    });
    if let Some(e) = sms.expediteur.filter(|e| !e.trim().is_empty()) {
        corps["sender"] = serde_json::Value::String(e);
    }
    let corps = corps.to_string();
    let signature = signature_ovh(&secret, &consommateur, "POST", &url, &corps, &horodatage);
    let reponse = c
        .post(&url)
        .header("Content-Type", "application/json")
        .header("X-Ovh-Application", sms.cle_application.trim())
        .header("X-Ovh-Consumer", consommateur)
        .header("X-Ovh-Timestamp", horodatage)
        .header("X-Ovh-Signature", signature)
        .body(corps)
        .send()
        .await
        .map_err(|e| e.without_url().to_string())?;
    let statut = reponse.status();
    let texte = tronquer(reponse.text().await.map_err(|e| e.without_url().to_string())?);
    if statut.is_success() {
        Ok(texte)
    } else {
        Err(format!("OVH a répondu HTTP {} : {}", statut.as_u16(), texte.chars().take(300).collect::<String>()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn noms_de_secret() {
        assert!(nom_valide("smtp"));
        assert!(nom_valide("ovh-secret"));
        assert!(!nom_valide(""));
        assert!(!nom_valide("a b"));
        assert!(!nom_valide("../x"));
    }

    #[test]
    fn substitution_sans_marqueur() {
        assert_eq!(substituer("https://ntfy.sh/mon-sujet").unwrap(), "https://ntfy.sh/mon-sujet");
        assert!(substituer("abc {{secret:smtp").is_err()); // marqueur non fermé
    }

    #[test]
    fn signature_ovh_connue() {
        // Valeur calculée indépendamment : sha1("s+c+POST+https://x/y+{}+1") .
        let s = signature_ovh("s", "c", "POST", "https://x/y", "{}", "1");
        assert!(s.starts_with("$1$") && s.len() == 3 + 40);
        assert_eq!(s, signature_ovh("s", "c", "POST", "https://x/y", "{}", "1"));
        assert_ne!(s, signature_ovh("s", "c", "POST", "https://x/y", "{}", "2"));
    }

    /// Vrai aller-retour : coffre du système, substitution du secret, requête HTTP vers un serveur local, aucune fuite dans l'erreur.
    #[cfg(any(windows, target_os = "macos"))]
    #[test]
    fn requete_avec_secret_du_coffre() {
        use std::io::{Read, Write};
        let ecoute = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = ecoute.local_addr().unwrap().port();
        let serveur = std::thread::spawn(move || {
            let (mut flux, _) = ecoute.accept().unwrap();
            let mut tampon = [0u8; 4096];
            let n = flux.read(&mut tampon).unwrap();
            flux.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok").unwrap();
            String::from_utf8_lossy(&tampon[..n]).to_string()
        });
        secret_definir("test-envoi".into(), "valeur-secrete-123".into()).unwrap();
        assert!(secret_existe("test-envoi".into()));
        let r = Requete {
            methode: "POST".into(),
            url: format!("http://127.0.0.1:{port}/chemin"),
            entetes: vec![("X-Test".into(), "Bearer {{secret:test-envoi}}".into())],
            corps: Some("{\"a\":1}".into()),
            delai_s: Some(5),
        };
        let reponse = tauri::async_runtime::block_on(http_requete(r)).unwrap();
        let recu = serveur.join().unwrap().to_lowercase();
        assert_eq!((reponse.statut, reponse.corps.as_str()), (200, "ok"));
        assert!(recu.starts_with("post /chemin"), "{recu}");
        assert!(recu.contains("x-test: bearer valeur-secrete-123"), "{recu}");
        assert!(recu.ends_with("{\"a\":1}"), "{recu}");
        secret_definir("test-envoi".into(), String::new()).unwrap();
        assert!(!secret_existe("test-envoi".into()));
        // Secret absent : refus net, sans requête.
        let r = Requete { methode: "GET".into(), url: "http://127.0.0.1:1/{{secret:test-envoi}}".into(), entetes: vec![], corps: None, delai_s: None };
        let erreur = tauri::async_runtime::block_on(http_requete(r)).err().unwrap();
        assert!(erreur.contains("non renseigné"), "{erreur}");
    }

    /// Message complet vers un faux serveur SMTP local (sans chiffrement ni authentification) : en-têtes, destinataires, corps texte et HTML.
    #[test]
    fn mail_vers_un_serveur_smtp_local() {
        use std::io::{BufRead, BufReader, Write};
        let ecoute = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = ecoute.local_addr().unwrap().port();
        let serveur = std::thread::spawn(move || {
            let (flux, _) = ecoute.accept().unwrap();
            let mut ecrit = flux.try_clone().unwrap();
            let mut lit = BufReader::new(flux);
            let mut recu = String::new();
            ecrit.write_all(b"220 test ESMTP\r\n").unwrap();
            let mut donnees = false;
            loop {
                let mut ligne = String::new();
                if lit.read_line(&mut ligne).unwrap() == 0 {
                    break;
                }
                if donnees {
                    if ligne == ".\r\n" {
                        donnees = false;
                        ecrit.write_all(b"250 OK\r\n").unwrap();
                    } else {
                        recu.push_str(&ligne);
                    }
                    continue;
                }
                recu.push_str(&format!("> {ligne}"));
                let commande = ligne.to_uppercase();
                if commande.starts_with("EHLO") || commande.starts_with("HELO") {
                    ecrit.write_all(b"250 test\r\n").unwrap();
                } else if commande.starts_with("DATA") {
                    donnees = true;
                    ecrit.write_all(b"354 go\r\n").unwrap();
                } else if commande.starts_with("QUIT") {
                    ecrit.write_all(b"221 bye\r\n").unwrap();
                    break;
                } else {
                    ecrit.write_all(b"250 OK\r\n").unwrap();
                }
            }
            recu
        });
        envoyer_mail_bloquant(Mail {
            serveur: "127.0.0.1".into(),
            port,
            securite: "aucune".into(),
            utilisateur: String::new(),
            expediteur: "Hune <hune@example.org>".into(),
            destinataires: vec!["moi@example.org".into(), "autre@example.org".into()],
            sujet: "Alerte : é BTC".into(),
            texte: "Prix ≥ 70 000".into(),
            html: Some("<p>Prix &ge; 70 000</p>".into()),
        })
        .unwrap();
        let recu = serveur.join().unwrap();
        assert!(recu.contains("> MAIL FROM:<hune@example.org>"), "{recu}");
        assert!(recu.contains("RCPT TO:<moi@example.org>") && recu.contains("RCPT TO:<autre@example.org>"), "{recu}");
        assert!(recu.contains("Subject: Alerte : =?utf-8?b?w6k=?= BTC"), "{recu}"); // le « é » du sujet est encodé
        assert!(recu.contains("multipart/alternative") && recu.contains("text/plain") && recu.contains("text/html"), "{recu}");
    }

    #[test]
    fn troncature_respecte_les_caracteres() {
        let long = "é".repeat(REPONSE_MAX);
        let t = tronquer(long);
        assert!(t.len() <= REPONSE_MAX && t.chars().all(|c| c == 'é'));
    }
}
