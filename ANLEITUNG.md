# Nur – Anleitung

Nur ist eine Web-App (PWA) für Habits, Gebetszeiten, Kalender und Deep-Work-Fokus.
Sie läuft komplett auf deinem iPhone: kein Abo, keine externe API, kein Konto.

---

## 1. Am PC testen (2 Minuten)

1. Doppelklick auf `start-lokal.bat` (Python muss installiert sein).
2. Im Browser `http://localhost:8765` öffnen.
3. Für die iPhone-Ansicht: In Chrome `F12` drücken, dann oben links auf das Handy-Symbol klicken.

Ohne die .bat-Datei geht es auch so: Öffne ein Terminal in diesem Ordner und führe `python -m http.server 8765` aus.

---

## 2. Aufs iPhone bringen (einmalig, ca. 10 Minuten, kostenlos)

Das iPhone verlangt für Offline-Modus und Installation eine **HTTPS-Adresse**.
GitHub Pages stellt sie kostenlos und dauerhaft bereit.

1. Auf **github.com** ein kostenloses Konto anlegen.
2. Oben rechts **+ → New repository** wählen.
   - Name: `nur`
   - Sichtbarkeit: **Public**
   - Dann **Create repository** klicken.
3. Auf **„uploading an existing file“** klicken.
4. **Den Inhalt** dieses Ordners hineinziehen: `index.html`, `sw.js`, `manifest.webmanifest` und die Ordner `css`, `js`, `icons`, `widgets`. Den Ordner selbst nicht hochladen.
5. Auf **Commit changes** klicken.
6. Im Repository **Settings → Pages** öffnen.
   - Source: **Deploy from a branch**
   - Branch: **main** und **/ (root)**
   - Dann **Save** klicken.
7. 1–2 Minuten warten. Deine Adresse lautet dann:
   `https://DEIN-NAME.github.io/nur/`

### Auf dem iPhone installieren

1. Die Adresse in **Safari** öffnen. Andere Browser können keine Web-Apps installieren.
2. Unten auf **Teilen** (Quadrat mit Pfeil) tippen.
3. **„Zum Home-Bildschirm“** wählen und dann auf **Hinzufügen** tippen.
4. Ab jetzt die App **nur über das neue Symbol** starten.

> Wichtig: Safari und die installierte App speichern Daten **getrennt**.
> Richte alles in der installierten App ein.

---

## 3. Updates

Jede Änderung lädst du auf GitHub hoch (**Add file → Upload files**, dann die geänderten Dateien ersetzen).
Die App holt sich die neue Version automatisch beim nächsten Öffnen.
Du musst sie nicht neu installieren, und deine Daten bleiben erhalten.

---

## 4. Widgets einrichten

Echte iOS-Widgets erlaubt Apple nur nativen Apps.
Die kostenlose App **Scriptable** schließt diese Lücke.

1. **Scriptable** aus dem App Store laden.
2. In Nur: **Heute → Widgets** öffnen, dann bei einem Widget auf **Kopieren** tippen.
3. In Scriptable auf **+** tippen, den Code einfügen und dem Skript einen Namen geben.
4. Home-Bildschirm lange drücken, auf **+** tippen, **Scriptable** wählen und das Widget hinzufügen.
5. Widget antippen, unter **Script** dein Skript wählen.

| Widget | Was es zeigt | Braucht Sync? |
|---|---|---|
| `nur-gebet.js` | Nächstes Gebet, Countdown, alle Zeiten. **Plant auch Gebets-Mitteilungen.** | Nein |
| `nur-vers.js` | Vers oder Hadith des Tages (Parameter `hadith` oder `mix`) | Nein |
| `nur-habits.js` | Habit-Fortschritt und nächste Termine | Ja |

**Sync für das Habits-Widget:** In Nur unter **Widgets** auf **Widget-Daten aktualisieren** tippen.
Dann **In Dateien sichern** wählen und die Datei in **iCloud Drive → Scriptable** speichern (vorhandene Datei ersetzen).

---

## 5. Social Media und Erwachsenen-Inhalte wirklich sperren

Eine Web-App darf keine anderen Apps steuern. Diese Sperren übernimmt iOS selbst.
Die vollständige Anleitung findest du in der App unter **Fokus → Schild-Symbol**. Kurz:

- **Bildschirmzeit → App-Limits:** Soziale Netzwerke auf z. B. 30 Minuten pro Tag begrenzen.
- **Bildschirmzeit → Beschränkungen → Webinhalte:** „Websites für Erwachsene beschränken“ wählen.
- **Kurzbefehle → Automation:** Wenn Instagram geöffnet wird, „Zum Home-Bildschirm“ ausführen.
- Den Bildschirmzeit-Code von einer Vertrauensperson setzen lassen.

Innerhalb von Nur blockiert ein Filter jede Eingabe und jeden Link mit eindeutigen Erwachsenen-Inhalten.

---

## 6. Datensicherung

**Einstellungen → Backup erstellen** speichert alle Daten in einer Datei, z. B. in iCloud Drive.
Mit **Backup wiederherstellen** holst du sie zurück, auch auf einem neuen iPhone.

---

## Was technisch nicht geht (Grenzen von iOS)

- Eine Web-App kann andere Apps nicht sperren. Dafür gibt es die iOS-Bildschirmzeit (siehe Punkt 5).
- Mitteilungen bei geschlossener App gibt es nur über das Scriptable-Gebets-Widget.
- Ein Tipp aufs Widget öffnet Safari, nicht die installierte App.
- Siri und der Action Button können die Web-App nicht direkt steuern. Sie können aber den iOS-Fokus „Lernen“ einschalten.
