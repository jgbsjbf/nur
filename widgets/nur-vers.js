// Nur – Vers- und Hadith-Widget für Scriptable
// Wechselt jeden Tag, komplett offline. Größen: klein, mittel, groß, Sperrbildschirm.
// Widget-Parameter (optional): "hadith" für Hadithe, "mix" für abwechselnd.

const VERSES = [["Denn wahrlich, mit der Erschwernis kommt Erleichterung.","Koran 94:6"],["Allah erlegt keiner Seele mehr auf, als sie zu tragen vermag.","Koran 2:286"],["So gedenkt Meiner, dann gedenke Ich euer.","Koran 2:152"],["Wahrlich, im Gedenken Allahs finden die Herzen Ruhe.","Koran 13:28"],["O ihr, die ihr glaubt, sucht Hilfe in Geduld und Gebet. Allah ist mit den Geduldigen.","Koran 2:153"],["Und wer auf Allah vertraut, dem ist Er genug.","Koran 65:3"],["Verzweifelt nicht an der Barmherzigkeit Allahs. Allah vergibt die Sünden alle.","Koran 39:53"],["Und wenn Meine Diener dich nach Mir fragen: Ich bin nahe.","Koran 2:186"],["Und sag: Mein Herr, mehre mir Wissen.","Koran 20:114"],["Werdet nicht schwach und seid nicht traurig, denn ihr werdet die Oberhand haben, wenn ihr gläubig seid.","Koran 3:139"],["Diejenigen, die sich um Unseretwillen abmühen, werden Wir ganz gewiss Unsere Wege leiten.","Koran 29:69"],["Und dass dem Menschen nur das zusteht, worum er sich bemüht.","Koran 53:39"],["Und nähert euch nicht der Unzucht. Sie ist etwas Schändliches und ein übler Weg.","Koran 17:32"],["Sag den gläubigen Männern, sie sollen ihre Blicke senken und ihre Keuschheit bewahren.","Koran 24:30"],["Gewiss, das Gebet hält ab vom Schändlichen und Verwerflichen.","Koran 29:45"],["Bei der Zeit! Der Mensch ist wahrlich im Verlust, außer denen, die glauben, Gutes tun und einander zur Wahrheit und Geduld anhalten.","Koran 103:1–3"],["Wenn du nun fertig bist, dann mühe dich weiter, und nach deinem Herrn richte dein Sehnen.","Koran 94:7–8"],["Ruft Mich an, so erhöre Ich euch.","Koran 40:60"],["Und Er ist mit euch, wo immer ihr seid.","Koran 57:4"],["Wir sind ihm näher als seine Halsschlagader.","Koran 50:16"],["Vielleicht ist euch etwas zuwider, obwohl es gut für euch ist.","Koran 2:216"],["Und wenn du dich entschlossen hast, dann vertraue auf Allah.","Koran 3:159"],["Wenn ihr dankbar seid, werde Ich euch ganz gewiss mehr geben.","Koran 14:7"],["Allah will es euch leicht machen, denn der Mensch wurde schwach erschaffen.","Koran 4:28"],["O ihr, die ihr glaubt, gedenkt Allahs in häufigem Gedenken.","Koran 33:41"],["Wer Gutes tut, ob Mann oder Frau, und gläubig ist, dem werden Wir ein gutes Leben geben.","Koran 16:97"],["Und sucht Hilfe in der Geduld und im Gebet.","Koran 2:45"],["Und Allah liebt die Standhaften.","Koran 3:146"],["Allah verändert die Lage eines Volkes nicht, bis sie das verändern, was in ihnen selbst ist.","Koran 13:11"],["Und wer Allah fürchtet, dem schafft Er einen Ausweg.","Koran 65:2"]];
const HADITHS = [["Die Taten werden nur nach den Absichten beurteilt.","Bukhari 1, Muslim 1907"],["Die Allah liebsten Taten sind die beständigsten, auch wenn sie wenig sind.","Bukhari 6464, Muslim 783"],["Der Starke ist nicht der, der andere niederringt, sondern der, der sich im Zorn beherrscht.","Bukhari 6114"],["Wer einen Weg geht, um Wissen zu suchen, dem erleichtert Allah einen Weg ins Paradies.","Muslim 2699"],["Zwei Gaben, bei denen viele Menschen betrogen werden: Gesundheit und freie Zeit.","Bukhari 6412"],["Keiner von euch glaubt wirklich, bis er für seinen Bruder liebt, was er für sich selbst liebt.","Bukhari 13, Muslim 45"],["Dein Lächeln für deinen Bruder ist eine Sadaqa.","Tirmidhi 1956"],["Wer an Allah und den Jüngsten Tag glaubt, soll Gutes sagen oder schweigen.","Bukhari 6018, Muslim 47"],["Fürchte Allah, wo immer du bist. Lass einer schlechten Tat eine gute folgen, die sie tilgt, und begegne den Menschen mit gutem Charakter.","Tirmidhi 1987"],["Sei in dieser Welt wie ein Fremder oder ein Reisender.","Bukhari 6416"],["Zum guten Islam eines Menschen gehört, dass er lässt, was ihn nichts angeht.","Tirmidhi 2317"],["Macht es leicht und macht es nicht schwer. Verkündet Frohes und schreckt nicht ab.","Bukhari 69"],["Reichtum ist nicht die Menge an Besitz, Reichtum ist der Reichtum der Seele.","Bukhari 6446"],["Das Gebet ist Licht.","Muslim 223"],["Die Reinheit ist die Hälfte des Glaubens.","Muslim 223"],["Allah ist schön und liebt die Schönheit.","Muslim 91"],["Wer etwas um Allahs willen aufgibt, dem gibt Allah etwas Besseres dafür.","Ahmad 23074"],["Achte auf Allah, so achtet Er auf dich.","Tirmidhi 2516"],["Strebe nach dem, was dir nützt, suche Hilfe bei Allah und gib nicht auf.","Muslim 2664"],["Der Gläubige ist für den Gläubigen wie ein Gebäude, dessen Teile einander stützen.","Bukhari 481"],["Nutze fünf vor fünf: deine Jugend vor dem Alter, deine Gesundheit vor der Krankheit, deinen Reichtum vor der Armut, deine Freizeit vor der Beschäftigung und dein Leben vor dem Tod.","al-Hakim 7846"],["Wer seine Zunge und seine Keuschheit bewahrt, dem verbürge ich das Paradies.","Bukhari 6474"]];

const param = (args.widgetParameter || '').toLowerCase();
const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
const useHadith = param === 'hadith' || (param === 'mix' && day % 2 === 1);
const list = useHadith ? HADITHS : VERSES;
const [text, src] = list[day % list.length];
const fam = config.widgetFamily || 'medium';
const GOLD = new Color(useHadith ? '#64D2FF' : '#E8C47C');

const w = new ListWidget();
const next = new Date(); next.setHours(24, 0, 5, 0); w.refreshAfterDate = next;

if (fam.startsWith('accessory')) {
  const t = w.addText(fam === 'accessoryInline' ? src : text);
  t.font = Font.systemFont(12); t.minimumScaleFactor = 0.6;
  if (fam === 'accessoryRectangular') { const s = w.addText(src); s.font = Font.boldSystemFont(10); }
} else {
  const g = new LinearGradient();
  g.colors = useHadith ? [new Color('#0f2a33'), new Color('#06121a')] : [new Color('#3a2d14'), new Color('#15100a')];
  g.locations = [0, 1]; w.backgroundGradient = g; w.setPadding(14, 16, 14, 16);
  const h = w.addText(useHadith ? 'HADITH DES TAGES' : 'VERS DES TAGES'); h.font = Font.semiboldSystemFont(10); h.textColor = GOLD;
  w.addSpacer(6);
  const t = w.addText('„' + text + '“');
  t.font = new Font('NewYork-Regular', fam === 'small' ? 13 : fam === 'large' ? 22 : 15);
  t.textColor = Color.white(); t.minimumScaleFactor = 0.55;
  w.addSpacer();
  const s = w.addText(src); s.font = Font.semiboldSystemFont(11); s.textColor = GOLD;
}
if (config.runsInWidget || config.runsInAccessoryWidget) Script.setWidget(w); else await w.presentMedium();
Script.complete();
