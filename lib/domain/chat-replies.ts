import { LOCALES, type Locale } from "@/lib/i18n/config";

/**
 * The answers operations sends most often, written once in six languages.
 *
 * ## Why these are ids rather than text
 *
 * An operator picks a reply in English and the person reads it in the language
 * they set. That is not translation — it is the same answer, authored six
 * times, chosen once. No API, no per-character bill, and nothing that can come
 * back as a mistranslation of a price or a legal requirement.
 *
 * The trade is that it only covers what is written here. Anything an operator
 * types themselves goes out as typed; see the note in `lib/domain/chat.ts`.
 *
 * ## Why they are stored as an id
 *
 * The message keeps `replyId`, not the sentence. Two consequences worth having:
 * a thread renders in whatever language the reader wants at the moment they
 * read it, and correcting a clumsy sentence fixes every conversation it was
 * ever sent in rather than only the next one.
 */

export interface StandardReply {
  readonly id: string;
  /** What the operator sees on the button. Short enough to scan a list of ten. */
  readonly label: string;
  readonly text: Record<Locale, string>;
}

export const STANDARD_REPLIES: readonly StandardReply[] = [
  {
    id: "greet",
    label: "Hello, how can we help",
    text: {
      en: "Hello, thanks for writing in. What can we help you with?",
      ta: "வணக்கம், எழுதியதற்கு நன்றி. நாங்கள் எப்படி உதவ முடியும்?",
      te: "నమస్కారం, రాసినందుకు ధన్యవాదాలు. మేము ఎలా సహాయపడగలం?",
      kn: "ನಮಸ್ಕಾರ, ಬರೆದಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ನಾವು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
      ml: "നമസ്കാരം, എഴുതിയതിന് നന്ദി. ഞങ്ങൾക്ക് എങ്ങനെ സഹായിക്കാം?",
      hi: "नमस्ते, लिखने के लिए धन्यवाद। हम आपकी क्या मदद कर सकते हैं?",
    },
  },
  {
    id: "farmerRegister",
    label: "How a farmer registers",
    text: {
      en: "Registering is free and takes a minute. Open the sign-in page, enter your mobile number, and type the code we send you. Then tell us your name and village and you are in.",
      ta: "பதிவு இலவசம், ஒரு நிமிடம் தான். உள்நுழைவு பக்கத்தைத் திறந்து, உங்கள் கைபேசி எண்ணை உள்ளிட்டு, நாங்கள் அனுப்பும் குறியீட்டைத் தட்டச்சு செய்யுங்கள். பிறகு உங்கள் பெயரையும் ஊரையும் சொன்னால் போதும்.",
      te: "నమోదు ఉచితం, ఒక నిమిషం పడుతుంది. సైన్ ఇన్ పేజీ తెరిచి, మీ మొబైల్ నంబర్ ఇచ్చి, మేము పంపే కోడ్ టైప్ చేయండి. తర్వాత మీ పేరు, ఊరు చెబితే సరిపోతుంది.",
      kn: "ನೋಂದಣಿ ಉಚಿತ, ಒಂದು ನಿಮಿಷ ಸಾಕು. ಸೈನ್ ಇನ್ ಪುಟ ತೆರೆದು, ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನೀಡಿ, ನಾವು ಕಳುಹಿಸುವ ಕೋಡ್ ಟೈಪ್ ಮಾಡಿ. ನಂತರ ನಿಮ್ಮ ಹೆಸರು ಮತ್ತು ಊರು ತಿಳಿಸಿದರೆ ಸಾಕು.",
      ml: "രജിസ്ട്രേഷൻ സൗജന്യമാണ്, ഒരു മിനിറ്റ് മതി. സൈൻ ഇൻ പേജ് തുറന്ന് നിങ്ങളുടെ മൊബൈൽ നമ്പർ നൽകി, ഞങ്ങൾ അയക്കുന്ന കോഡ് ടൈപ്പ് ചെയ്യുക. പിന്നെ പേരും ഗ്രാമവും പറഞ്ഞാൽ മതി.",
      hi: "पंजीकरण मुफ़्त है और एक मिनट लगता है। साइन इन पेज खोलें, अपना मोबाइल नंबर डालें और हमारा भेजा कोड टाइप करें। फिर अपना नाम और गाँव बताएँ, बस।",
    },
  },
  {
    id: "farmerCost",
    label: "What it costs a farmer",
    text: {
      en: "Nothing to list, and nothing deducted for transport. The price you accept is the price that settles, adjusted only by the grade recorded in front of you at collection and the actual weight loaded.",
      ta: "பட்டியலிட எந்தக் கட்டணமும் இல்லை, போக்குவரத்துக்கும் பிடித்தம் இல்லை. நீங்கள் ஏற்ற விலையே இறுதி விலை — சேகரிப்பின்போது உங்கள் முன்னிலையில் பதிவு செய்யப்படும் தரமும், ஏற்றப்படும் உண்மையான எடையும் மட்டுமே அதை மாற்றும்.",
      te: "జాబితా చేయడానికి ఖర్చు లేదు, రవాణాకు కోత లేదు. మీరు అంగీకరించిన ధరే చెల్లుతుంది — సేకరణ సమయంలో మీ ఎదుటే నమోదైన గ్రేడ్, లోడ్ చేసిన నిజమైన బరువు మాత్రమే దాన్ని మారుస్తాయి.",
      kn: "ಪಟ್ಟಿ ಮಾಡಲು ಶುಲ್ಕವಿಲ್ಲ, ಸಾಗಣೆಗೆ ಕಡಿತವಿಲ್ಲ. ನೀವು ಒಪ್ಪಿದ ಬೆಲೆಯೇ ಅಂತಿಮ — ಸಂಗ್ರಹಣೆಯ ವೇಳೆ ನಿಮ್ಮ ಎದುರೇ ದಾಖಲಾದ ದರ್ಜೆ ಮತ್ತು ಲೋಡ್ ಆದ ನಿಜವಾದ ತೂಕ ಮಾತ್ರ ಅದನ್ನು ಬದಲಿಸುತ್ತವೆ.",
      ml: "ലിസ്റ്റ് ചെയ്യാൻ ചെലവില്ല, ഗതാഗതത്തിന് കിഴിവുമില്ല. നിങ്ങൾ സമ്മതിച്ച വിലയാണ് അന്തിമം — ശേഖരണ സമയത്ത് നിങ്ങളുടെ മുന്നിൽ രേഖപ്പെടുത്തുന്ന ഗ്രേഡും കയറ്റിയ യഥാർഥ തൂക്കവും മാത്രമേ അതിനെ മാറ്റൂ.",
      hi: "सूची में डालने का कोई शुल्क नहीं, और ढुलाई की कोई कटौती नहीं। आप जो दाम मानते हैं वही चुकता होता है — सिर्फ़ संग्रह के समय आपके सामने दर्ज ग्रेड और लदा असली वज़न ही उसे बदलते हैं।",
    },
  },
  {
    id: "buyerDocuments",
    label: "Documents a buyer needs",
    text: {
      en: "A buyer needs GST, PAN and an FSSAI licence. Upload them once after registering. Nothing can be bought until operations has checked them, so it is worth doing first.",
      ta: "வாங்குபவருக்கு GST, PAN மற்றும் FSSAI உரிமம் தேவை. பதிவு செய்த பிறகு ஒரு முறை பதிவேற்றினால் போதும். செயல்பாட்டுக் குழு அவற்றைச் சரிபார்க்கும் வரை எதுவும் வாங்க முடியாது, எனவே இதை முதலில் செய்வது நல்லது.",
      te: "కొనుగోలుదారుకు GST, PAN, FSSAI లైసెన్స్ కావాలి. నమోదు తర్వాత ఒకసారి అప్‌లోడ్ చేస్తే చాలు. ఆపరేషన్స్ వాటిని తనిఖీ చేసే వరకు ఏదీ కొనలేరు, కాబట్టి ముందుగా చేయడం మంచిది.",
      kn: "ಖರೀದಿದಾರರಿಗೆ GST, PAN ಮತ್ತು FSSAI ಪರವಾನಗಿ ಬೇಕು. ನೋಂದಣಿಯ ನಂತರ ಒಮ್ಮೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಿದರೆ ಸಾಕು. ಕಾರ್ಯಾಚರಣೆ ತಂಡ ಪರಿಶೀಲಿಸುವವರೆಗೆ ಏನನ್ನೂ ಕೊಳ್ಳಲಾಗದು, ಹಾಗಾಗಿ ಮೊದಲೇ ಮಾಡುವುದು ಒಳ್ಳೆಯದು.",
      ml: "വാങ്ങുന്നയാൾക്ക് GST, PAN, FSSAI ലൈസൻസ് വേണം. രജിസ്റ്റർ ചെയ്ത ശേഷം ഒരിക്കൽ അപ്‌ലോഡ് ചെയ്താൽ മതി. ഓപ്പറേഷൻസ് പരിശോധിക്കുന്നതുവരെ ഒന്നും വാങ്ങാനാവില്ല, അതിനാൽ ആദ്യം ചെയ്യുന്നതാണ് നല്ലത്.",
      hi: "खरीदार को GST, PAN और FSSAI लाइसेंस चाहिए। पंजीकरण के बाद एक बार अपलोड कर दें। जाँच पूरी होने तक कुछ भी खरीदा नहीं जा सकता, इसलिए यह पहले कर लेना बेहतर है।",
    },
  },
  {
    id: "verificationTime",
    label: "How long verification takes",
    text: {
      en: "Documents are usually checked within two working days. You can sign in and look around while you wait — only trading is held back until the check is done.",
      ta: "ஆவணங்கள் பொதுவாக இரண்டு வேலை நாட்களுக்குள் சரிபார்க்கப்படும். காத்திருக்கும் போது உள்நுழைந்து பார்வையிடலாம் — சரிபார்ப்பு முடியும் வரை வர்த்தகம் மட்டுமே நிறுத்தி வைக்கப்படும்.",
      te: "పత్రాలు సాధారణంగా రెండు పని దినాల్లో తనిఖీ అవుతాయి. వేచి ఉన్నప్పుడు సైన్ ఇన్ చేసి చూడవచ్చు — తనిఖీ పూర్తయ్యే వరకు వ్యాపారం మాత్రమే ఆగి ఉంటుంది.",
      kn: "ದಾಖಲೆಗಳನ್ನು ಸಾಮಾನ್ಯವಾಗಿ ಎರಡು ಕೆಲಸದ ದಿನಗಳಲ್ಲಿ ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ. ಕಾಯುವಾಗ ಸೈನ್ ಇನ್ ಮಾಡಿ ನೋಡಬಹುದು — ಪರಿಶೀಲನೆ ಮುಗಿಯುವವರೆಗೆ ವ್ಯಾಪಾರ ಮಾತ್ರ ನಿಂತಿರುತ್ತದೆ.",
      ml: "രേഖകൾ സാധാരണ രണ്ട് പ്രവൃത്തി ദിവസത്തിനുള്ളിൽ പരിശോധിക്കും. കാത്തിരിക്കുമ്പോൾ സൈൻ ഇൻ ചെയ്ത് നോക്കാം — പരിശോധന കഴിയുന്നതുവരെ വ്യാപാരം മാത്രമേ നിർത്തിവയ്ക്കൂ.",
      hi: "कागज़ात आम तौर पर दो कार्यदिवसों में जाँच लिए जाते हैं। इंतज़ार के दौरान आप साइन इन करके देख सकते हैं — जाँच पूरी होने तक सिर्फ़ व्यापार रुका रहता है।",
    },
  },
  {
    id: "coverage",
    label: "Where we operate",
    text: {
      en: "You can register from anywhere in India. Collection runs where we have opened districts — tell us your district and we will say whether we reach you yet.",
      ta: "இந்தியாவில் எங்கிருந்தும் பதிவு செய்யலாம். நாங்கள் திறந்துள்ள மாவட்டங்களில் சேகரிப்பு நடக்கிறது — உங்கள் மாவட்டத்தைச் சொன்னால், நாங்கள் அங்கு வருகிறோமா என்று சொல்கிறோம்.",
      te: "భారతదేశంలో ఎక్కడి నుంచైనా నమోదు చేసుకోవచ్చు. మేము తెరిచిన జిల్లాల్లో సేకరణ జరుగుతుంది — మీ జిల్లా చెబితే, మేము అక్కడికి వస్తామో లేదో చెబుతాం.",
      kn: "ಭಾರತದ ಎಲ್ಲಿಂದಲಾದರೂ ನೋಂದಾಯಿಸಬಹುದು. ನಾವು ತೆರೆದಿರುವ ಜಿಲ್ಲೆಗಳಲ್ಲಿ ಸಂಗ್ರಹಣೆ ನಡೆಯುತ್ತದೆ — ನಿಮ್ಮ ಜಿಲ್ಲೆ ತಿಳಿಸಿದರೆ, ನಾವು ಅಲ್ಲಿಗೆ ಬರುತ್ತೇವೆಯೇ ಎಂದು ಹೇಳುತ್ತೇವೆ.",
      ml: "ഇന്ത്യയിൽ എവിടെ നിന്നും രജിസ്റ്റർ ചെയ്യാം. ഞങ്ങൾ തുറന്ന ജില്ലകളിലാണ് ശേഖരണം — നിങ്ങളുടെ ജില്ല പറഞ്ഞാൽ, അവിടെ എത്തുന്നുണ്ടോ എന്ന് പറയാം.",
      hi: "आप भारत में कहीं से भी पंजीकरण कर सकते हैं। संग्रह उन ज़िलों में होता है जहाँ हमने शुरुआत की है — अपना ज़िला बताइए, हम बता देंगे कि वहाँ पहुँचते हैं या नहीं।",
    },
  },
  {
    id: "payment",
    label: "How payment works",
    text: {
      en: "The buyer's payment is held from the order until delivery is confirmed, then released to the farmer's bank account. Neither side is asked to go first.",
      ta: "வாங்குபவரின் பணம் ஆர்டரிலிருந்து டெலிவரி உறுதி செய்யப்படும் வரை பிடித்து வைக்கப்பட்டு, பிறகு விவசாயியின் வங்கிக் கணக்கிற்கு அனுப்பப்படும். இரு தரப்பிலும் யாரும் முதலில் நம்ப வேண்டியதில்லை.",
      te: "కొనుగోలుదారు చెల్లింపు ఆర్డర్ నుంచి డెలివరీ నిర్ధారణ వరకు నిలిపి ఉంచి, ఆ తర్వాత రైతు బ్యాంకు ఖాతాకు విడుదల చేస్తాం. ఇరువైపులా ఎవరూ ముందుగా నమ్మాల్సిన అవసరం లేదు.",
      kn: "ಖರೀದಿದಾರರ ಪಾವತಿಯನ್ನು ಆರ್ಡರ್‌ನಿಂದ ವಿತರಣೆ ದೃಢಪಡುವವರೆಗೆ ಹಿಡಿದಿಟ್ಟು, ನಂತರ ರೈತರ ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ ಬಿಡುಗಡೆ ಮಾಡಲಾಗುತ್ತದೆ. ಎರಡೂ ಕಡೆ ಯಾರೂ ಮೊದಲು ನಂಬಬೇಕಿಲ್ಲ.",
      ml: "വാങ്ങുന്നയാളുടെ പണം ഓർഡർ മുതൽ ഡെലിവറി ഉറപ്പാകുന്നതുവരെ പിടിച്ചുവച്ച്, പിന്നീട് കർഷകന്റെ ബാങ്ക് അക്കൗണ്ടിലേക്ക് നൽകും. ഇരുവരും ആദ്യം വിശ്വസിക്കേണ്ട ആവശ്യമില്ല.",
      hi: "खरीदार का भुगतान ऑर्डर से लेकर डिलीवरी की पुष्टि तक रोका जाता है, फिर किसान के बैंक खाते में भेज दिया जाता है। किसी भी पक्ष को पहले भरोसा नहीं करना पड़ता।",
    },
  },
  {
    id: "collection",
    label: "How collection works",
    text: {
      en: "Once a price is agreed, a vehicle is arranged and the produce is graded at your farm with you present. All three grade prices are agreed before the vehicle is sent, so nothing is renegotiated at the roadside.",
      ta: "விலை ஒப்புக்கொள்ளப்பட்டதும், வாகனம் ஏற்பாடு செய்யப்பட்டு, உங்கள் முன்னிலையில் பண்ணையிலேயே தரம் பிரிக்கப்படும். வாகனம் அனுப்பும் முன்பே மூன்று தர விலைகளும் ஒப்புக்கொள்ளப்படும், எனவே சாலையோரத்தில் மறுபேச்சு இல்லை.",
      te: "ధర అంగీకరించిన తర్వాత వాహనం ఏర్పాటు చేసి, మీ సమక్షంలో పొలంలోనే గ్రేడింగ్ జరుగుతుంది. వాహనం పంపే ముందే మూడు గ్రేడ్ ధరలూ ఖరారవుతాయి, కాబట్టి రోడ్డు పక్కన బేరం ఉండదు.",
      kn: "ಬೆಲೆ ಒಪ್ಪಿದ ನಂತರ ವಾಹನ ಏರ್ಪಡಿಸಿ, ನಿಮ್ಮ ಸಮ್ಮುಖದಲ್ಲೇ ಹೊಲದಲ್ಲಿ ದರ್ಜೆ ಮಾಡಲಾಗುತ್ತದೆ. ವಾಹನ ಕಳುಹಿಸುವ ಮೊದಲೇ ಮೂರೂ ದರ್ಜೆ ಬೆಲೆಗಳು ನಿಗದಿಯಾಗುತ್ತವೆ, ಹಾಗಾಗಿ ರಸ್ತೆಬದಿ ಚೌಕಾಸಿ ಇಲ್ಲ.",
      ml: "വില സമ്മതിച്ചാൽ വാഹനം ഏർപ്പാടാക്കി, നിങ്ങളുടെ സാന്നിധ്യത്തിൽ കൃഷിയിടത്തിൽ വച്ചുതന്നെ ഗ്രേഡ് ചെയ്യും. വാഹനം അയക്കും മുൻപേ മൂന്ന് ഗ്രേഡ് വിലയും തീരുമാനിക്കും, അതിനാൽ വഴിയരികിൽ വിലപേശലില്ല.",
      hi: "दाम तय होने पर गाड़ी भेजी जाती है और आपके सामने खेत पर ही ग्रेडिंग होती है। गाड़ी भेजने से पहले तीनों ग्रेड के दाम तय हो जाते हैं, इसलिए सड़क किनारे कोई मोलभाव नहीं होता।",
    },
  },
  {
    id: "callBack",
    label: "We will call you",
    text: {
      en: "We will call you on the number you gave us. If you would rather write, keep this window open and we will answer here.",
      ta: "நீங்கள் தந்த எண்ணுக்கு நாங்கள் அழைக்கிறோம். எழுதுவதையே விரும்பினால், இந்தச் சாளரத்தைத் திறந்து வையுங்கள், இங்கேயே பதில் அளிக்கிறோம்.",
      te: "మీరు ఇచ్చిన నంబర్‌కు మేము కాల్ చేస్తాం. రాయడమే ఇష్టమైతే, ఈ విండో తెరిచి ఉంచండి, ఇక్కడే బదులిస్తాం.",
      kn: "ನೀವು ನೀಡಿದ ಸಂಖ್ಯೆಗೆ ನಾವು ಕರೆ ಮಾಡುತ್ತೇವೆ. ಬರೆಯುವುದೇ ಇಷ್ಟವಾದರೆ, ಈ ಕಿಟಕಿಯನ್ನು ತೆರೆದಿಡಿ, ಇಲ್ಲಿಯೇ ಉತ್ತರಿಸುತ್ತೇವೆ.",
      ml: "നിങ്ങൾ തന്ന നമ്പറിൽ ഞങ്ങൾ വിളിക്കാം. എഴുതാനാണ് താൽപ്പര്യമെങ്കിൽ ഈ ജാലകം തുറന്നിടുക, ഇവിടെത്തന്നെ മറുപടി നൽകാം.",
      hi: "आपने जो नंबर दिया है उस पर हम कॉल करेंगे। अगर लिखना ही ठीक लगे तो यह विंडो खुली रखें, हम यहीं जवाब देंगे।",
    },
  },
  {
    id: "transportAgency",
    label: "For a transport or crew agency",
    text: {
      en: "Register as a transport or manpower agency from the sign-in page, then add your vehicles, drivers or crew in your own console. Loads are offered to you there and you accept the ones you want.",
      ta: "உள்நுழைவு பக்கத்திலிருந்து போக்குவரத்து அல்லது ஆள்பலம் நிறுவனமாகப் பதிவு செய்து, உங்கள் வாகனங்கள், ஓட்டுநர்கள் அல்லது பணியாளர்களை உங்கள் கன்சோலில் சேர்க்கவும். சரக்குகள் அங்கே வழங்கப்படும், விரும்புவதை ஏற்கலாம்.",
      te: "సైన్ ఇన్ పేజీ నుంచి రవాణా లేదా మ్యాన్‌పవర్ ఏజెన్సీగా నమోదు చేసుకుని, మీ వాహనాలు, డ్రైవర్లు లేదా సిబ్బందిని మీ కన్సోల్‌లో చేర్చండి. లోడ్‌లు అక్కడ మీకు అందిస్తాం, నచ్చినవి తీసుకోండి.",
      kn: "ಸೈನ್ ಇನ್ ಪುಟದಿಂದ ಸಾಗಣೆ ಅಥವಾ ಮಾನವಶಕ್ತಿ ಏಜೆನ್ಸಿಯಾಗಿ ನೋಂದಾಯಿಸಿ, ನಿಮ್ಮ ವಾಹನಗಳು, ಚಾಲಕರು ಅಥವಾ ಸಿಬ್ಬಂದಿಯನ್ನು ನಿಮ್ಮ ಕನ್ಸೋಲ್‌ನಲ್ಲಿ ಸೇರಿಸಿ. ಲೋಡ್‌ಗಳನ್ನು ಅಲ್ಲಿ ನೀಡಲಾಗುತ್ತದೆ, ಇಷ್ಟವಾದವನ್ನು ಸ್ವೀಕರಿಸಿ.",
      ml: "സൈൻ ഇൻ പേജിൽ നിന്ന് ട്രാൻസ്പോർട്ട് അല്ലെങ്കിൽ മാൻപവർ ഏജൻസിയായി രജിസ്റ്റർ ചെയ്ത്, നിങ്ങളുടെ വാഹനങ്ങളും ഡ്രൈവർമാരും ജീവനക്കാരും കൺസോളിൽ ചേർക്കുക. ലോഡുകൾ അവിടെ വാഗ്ദാനം ചെയ്യും, വേണ്ടത് സ്വീകരിക്കാം.",
      hi: "साइन इन पेज से परिवहन या श्रमिक एजेंसी के रूप में पंजीकरण करें, फिर अपने वाहन, चालक या कर्मचारी अपने कंसोल में जोड़ें। लदान वहीं पेश किए जाते हैं, जो चाहें स्वीकार करें।",
    },
  },
  {
    id: "languages",
    label: "About languages",
    text: {
      en: "The site is in English, Tamil, Telugu, Kannada, Malayalam and Hindi — change it from the button at the top. Crop names are held per district, because the same crop goes by different words in different places.",
      ta: "இந்தத் தளம் ஆங்கிலம், தமிழ், தெலுங்கு, கன்னடம், மலையாளம், இந்தி ஆகிய மொழிகளில் உள்ளது — மேலே உள்ள பொத்தானில் மாற்றலாம். ஒரே பயிர் வெவ்வேறு இடங்களில் வெவ்வேறு பெயர்களில் அழைக்கப்படுவதால், பயிர்ப் பெயர்கள் மாவட்ட வாரியாக வைக்கப்படுகின்றன.",
      te: "సైట్ ఇంగ్లిష్, తమిళం, తెలుగు, కన్నడ, మలయాళం, హిందీలో ఉంది — పైన ఉన్న బటన్‌తో మార్చుకోండి. ఒకే పంట వేర్వేరు చోట్ల వేర్వేరు పేర్లతో పిలవబడుతుంది కాబట్టి పంట పేర్లు జిల్లాల వారీగా ఉంచాం.",
      kn: "ಈ ತಾಣ ಇಂಗ್ಲಿಷ್, ತಮಿಳು, ತೆಲುಗು, ಕನ್ನಡ, ಮಲಯಾಳಂ ಮತ್ತು ಹಿಂದಿಯಲ್ಲಿದೆ — ಮೇಲಿನ ಗುಂಡಿಯಿಂದ ಬದಲಾಯಿಸಿ. ಒಂದೇ ಬೆಳೆ ಬೇರೆ ಬೇರೆ ಕಡೆ ಬೇರೆ ಹೆಸರಿನಿಂದ ಕರೆಯಲ್ಪಡುವುದರಿಂದ ಬೆಳೆ ಹೆಸರುಗಳನ್ನು ಜಿಲ್ಲಾವಾರು ಇಡಲಾಗಿದೆ.",
      ml: "സൈറ്റ് ഇംഗ്ലീഷ്, തമിഴ്, തെലുങ്ക്, കന്നഡ, മലയാളം, ഹിന്ദി ഭാഷകളിലുണ്ട് — മുകളിലെ ബട്ടണിൽ മാറ്റാം. ഒരേ വിള പല സ്ഥലങ്ങളിൽ പല പേരിൽ അറിയപ്പെടുന്നതിനാൽ വിളപ്പേരുകൾ ജില്ല തിരിച്ചാണ് സൂക്ഷിക്കുന്നത്.",
      hi: "यह साइट अंग्रेज़ी, तमिल, तेलुगु, कन्नड़, मलयालम और हिंदी में है — ऊपर के बटन से बदलें। एक ही फ़सल अलग-अलग जगह अलग नाम से पुकारी जाती है, इसलिए फ़सलों के नाम ज़िले के हिसाब से रखे जाते हैं।",
    },
  },
];

const BY_ID = new Map(STANDARD_REPLIES.map((reply) => [reply.id, reply]));

export function standardReply(id: string): StandardReply | undefined {
  return BY_ID.get(id);
}

/**
 * The text to show, in the reader's language.
 *
 * Falls back to the stored English rather than to nothing: a reply whose id no
 * longer exists — renamed, retired — must still render as whatever the operator
 * actually sent, because it is a record of a conversation that happened.
 */
export function replyText(id: string | undefined, locale: Locale, fallback: string): string {
  if (!id) return fallback;
  const reply = BY_ID.get(id);
  if (!reply) return fallback;
  return reply.text[locale] ?? reply.text.en;
}

/** Every reply carries every language, or somebody reads a blank bubble. */
export function missingTranslations(): string[] {
  const gaps: string[] = [];
  for (const reply of STANDARD_REPLIES) {
    for (const locale of LOCALES) {
      if (!reply.text[locale]?.trim()) gaps.push(`${reply.id}/${locale}`);
    }
  }
  return gaps;
}
