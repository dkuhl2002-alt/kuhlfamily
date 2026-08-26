# KuhlFamily – Einrichtung

## 1. GitHub
1. GitHub öffnen.
2. `+` → **New repository**.
3. Name: `kuhlfamily`.
4. **Public**.
5. **Create repository**.
6. **Add file → Upload files** und den kompletten Inhalt dieses Ordners hochladen.
7. **Commit changes**.
8. **Settings → Pages**.
9. Source: **Deploy from a branch**.
10. Branch **main**, Ordner **/(root)** → **Save**.

## 2. Firebase
1. Firebase Console öffnen und neues Projekt **KuhlFamily** erstellen.
2. Web-App `</>` registrieren, Name **KuhlFamily Web**. Firebase Hosting nicht nötig.
3. Die angezeigten `firebaseConfig`-Werte in `firebase-config.js` und `firebase-messaging-sw.js` eintragen.

## 3. Unsichtbare Anmeldung
1. Firebase → **Authentication → Sign-in method**.
2. **Anonymous / Anonym** aktivieren.
3. Es gibt weiterhin keinen sichtbaren Login. Die App meldet das Gerät nur technisch im Hintergrund an.

## 4. Firestore
1. **Firestore Database → Create database**.
2. Production mode.
3. Möglichst EU-Region wählen.
4. Unter **Rules** den Inhalt aus `firestore.rules` einsetzen und veröffentlichen.

## 5. Bilder / Dokumente
Für Produktbilder, Kassenbons, Terminanhänge, Wunschlisten-Screenshots und Reisedokumente: **Storage** aktivieren. Bei neuen Firebase-Projekten benötigt Cloud Storage den Blaze-Tarif. Danach `storage.rules` übernehmen. Ohne Storage funktionieren die Kernfunktionen trotzdem.

## 6. Push
1. Firebase → **Project settings → Cloud Messaging**.
2. Bei **Web Push certificates** ein Schlüsselpaar erzeugen.
3. Den öffentlichen VAPID-Key später in `firebase-config.js` eintragen.
4. Die Empfangsdatei `firebase-messaging-sw.js` liegt bereits bei.
5. Für automatische Erinnerungen im Hintergrund kommt als nächste Ausbaustufe eine Firebase Cloud Function dazu.

## 7. Dateien nach Firebase-Setup aktualisieren
Die beiden geänderten Dateien wieder bei GitHub hochladen bzw. bearbeiten und committen. GitHub Pages aktualisiert automatisch.

## 8. Handy
Android/Chrome: Menü `⋮` → **Zum Startbildschirm hinzufügen / App installieren**.
iPhone/Safari: Teilen → **Zum Home-Bildschirm**.

## Danach bauen wir fertig
1. Dashboard final
2. Wiederholungslogik Aufgaben
3. Produktdatenbank + Bilder + Barcode
4. Kalender + Anhänge + Erinnerungen
5. Kochideen + Zutaten → Einkauf
6. Aktivitäten + Wetter + Auto/Gehzeit + Maps
7. Finanzen + Diagramme + Kassenbons
8. Geburtstage
9. Wunschliste
10. Urlaub + Packlisten + Dokumente
11. Seat
12. KuhlMoments
13. Push-Automatik
