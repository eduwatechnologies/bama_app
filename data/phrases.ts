import { CategoryMeta, Phrase, PhraseCategory } from '@/types/phrase';

/**
 * Phrase translations are intentionally kept in one reviewable file.
 * Reviewers can update the translations map (keyed by language code) and
 * pronunciation here without needing to touch the screens or translation service.
 *
 * These categories are only used when the server is unreachable. Once synced,
 * categories come from the dashboard.
 */
export const categories: CategoryMeta[] = [
  { name: 'Greetings', description: 'Start with warmth', icon: 'sun', color: '#d9653b' },
  { name: 'Classroom', description: 'Help learning flow', icon: 'book-open', color: '#477a5b' },
  { name: 'Community', description: 'Connect respectfully', icon: 'users', color: '#4d557e' },
  { name: 'Daily Conversation', description: 'Everyday moments', icon: 'message-circle', color: '#b6853e' },
  { name: 'Market', description: 'Shop with confidence', icon: 'shopping-bag', color: '#41768a' },
  { name: 'Directions', description: 'Find your way', icon: 'compass', color: '#a8585d' },
  { name: 'Emergency', description: 'Get help quickly', icon: 'shield', color: '#b84b3a' },
];

const phrase = (
  id: string,
  category: PhraseCategory,
  english: string,
  hausa: string,
  pronunciation = hausa,
): Phrase => ({
  id,
  category,
  translations: { en: english, ha: hausa },
  pronunciation,
  audio: { en: null, ha: null },
  isFavorite: false,
  contentType: 'phrase' as const,
});

export const phrases: Phrase[] = [
  phrase('greeting-01', 'Greetings', 'Good morning', 'Ina kwana'),
  phrase('greeting-02', 'Greetings', 'Good afternoon', 'Ina yini'),
  phrase('greeting-03', 'Greetings', 'Good evening', 'Barka da yamma'),
  phrase('greeting-04', 'Greetings', 'How are you?', 'Yaya kake?', 'Yaya ka-ke?'),
  phrase('greeting-05', 'Greetings', 'I am fine', 'Lafiya lau'),
  phrase('greeting-06', 'Greetings', 'Welcome', 'Barka da zuwa'),
  phrase('greeting-07', 'Greetings', 'Thank you', 'Na gode'),
  phrase('greeting-08', 'Greetings', 'You are welcome', 'Babu komai'),
  phrase('greeting-09', 'Greetings', 'Please', 'Don Allah'),
  phrase('greeting-10', 'Greetings', 'Goodbye', 'Sai an jima'),

  phrase('classroom-01', 'Classroom', 'Sit down', 'Zauna'),
  phrase('classroom-02', 'Classroom', 'Stand up', 'Tashi'),
  phrase('classroom-03', 'Classroom', 'Listen carefully', 'Ku saurara da kyau'),
  phrase('classroom-04', 'Classroom', 'Read this', 'Karanta wannan'),
  phrase('classroom-05', 'Classroom', 'Write your name', 'Rubuta sunanka'),
  phrase('classroom-06', 'Classroom', 'Do you understand?', 'Ka fahimta?', 'Ka fa-him-ta?'),
  phrase('classroom-07', 'Classroom', 'I understand', 'Na fahimta'),
  phrase('classroom-08', 'Classroom', 'Repeat after me', 'Maimaita bayana'),
  phrase('classroom-09', 'Classroom', 'Open your book', 'Bude littafinka'),
  phrase('classroom-10', 'Classroom', 'Any questions?', 'Akwai tambaya?'),

  phrase('community-01', 'Community', 'What is your name?', 'Menene sunanka?', 'Me-ne-ne sunan-ka?'),
  phrase('community-02', 'Community', 'My name is...', 'Sunana...'),
  phrase('community-03', 'Community', 'Where do you live?', 'Ina kake zama?'),
  phrase('community-04', 'Community', 'I am from Nigeria', 'Ni dan Najeriya ne'),
  phrase('community-05', 'Community', 'I am here to help', 'Na zo ne don taimako'),
  phrase('community-06', 'Community', 'Let us work together', 'Mu yi aiki tare'),
  phrase('community-07', 'Community', 'This is important', 'Wannan yana da muhimmanci'),
  phrase('community-08', 'Community', 'Please tell me', 'Don Allah ka gaya mini'),
  phrase('community-09', 'Community', 'I need your help', 'Ina bukatar taimakonka'),
  phrase('community-10', 'Community', 'See you tomorrow', 'Sai gobe'),

  phrase('daily-01', 'Daily Conversation', 'How is your day?', 'Yaya ranarka?'),
  phrase('daily-02', 'Daily Conversation', 'I am hungry', 'Ina jin yunwa'),
  phrase('daily-03', 'Daily Conversation', 'I am thirsty', 'Ina jin kishirwa'),
  phrase('daily-04', 'Daily Conversation', 'Let us go', 'Mu tafi'),
  phrase('daily-05', 'Daily Conversation', 'Wait a moment', 'Jira kadan'),
  phrase('daily-06', 'Daily Conversation', 'Come here', 'Zo nan'),
  phrase('daily-07', 'Daily Conversation', 'What happened?', 'Me ya faru?'),
  phrase('daily-08', 'Daily Conversation', 'I do not know', 'Ban sani ba'),
  phrase('daily-09', 'Daily Conversation', 'That is okay', 'Ba komai'),
  phrase('daily-10', 'Daily Conversation', 'See you later', 'Sai an jima'),

  phrase('market-01', 'Market', 'How much is this?', 'Nawa ne wannan?'),
  phrase('market-02', 'Market', 'I want to buy this', 'Ina son in sayi wannan'),
  phrase('market-03', 'Market', 'That is too expensive', 'Wannan ya yi tsada sosai'),
  phrase('market-04', 'Market', 'Can you reduce the price?', 'Za ka rage farashin?'),
  phrase('market-05', 'Market', 'Do you have something smaller?', 'Kana da karami?'),
  phrase('market-06', 'Market', 'I am just looking', 'Ina kallo ne kawai'),
  phrase('market-07', 'Market', 'Give me two', 'Ba ni guda biyu'),
  phrase('market-08', 'Market', 'Do you accept cash?', 'Kuna karbar kudi?'),
  phrase('market-09', 'Market', 'Where is the market?', 'Ina kasuwa?'),
  phrase('market-10', 'Market', 'Thank you, I will come back', 'Na gode, zan dawo'),

  phrase('direction-01', 'Directions', 'Where is the school?', 'Ina makaranta?'),
  phrase('direction-02', 'Directions', 'Where is the hospital?', 'Ina asibiti?'),
  phrase('direction-03', 'Directions', 'Go straight', 'Je kai tsaye'),
  phrase('direction-04', 'Directions', 'Turn left', 'Juya hagu'),
  phrase('direction-05', 'Directions', 'Turn right', 'Juya dama'),
  phrase('direction-06', 'Directions', 'It is near here', 'Yana kusa da nan'),
  phrase('direction-07', 'Directions', 'It is far from here', 'Yana nesa da nan'),
  phrase('direction-08', 'Directions', 'Please show me the way', 'Don Allah nuna mini hanya'),
  phrase('direction-09', 'Directions', 'Can I walk there?', 'Zan iya tafiya can?'),
  phrase('direction-10', 'Directions', 'Stop here', 'Tsaya nan'),

  phrase('emergency-01', 'Emergency', 'Help!', 'Taimako!'),
  phrase('emergency-02', 'Emergency', 'Call the police', 'Kira ’yan sanda'),
  phrase('emergency-03', 'Emergency', 'Call an ambulance', 'Kira motar asibiti'),
  phrase('emergency-04', 'Emergency', 'I am hurt', 'Na ji rauni'),
  phrase('emergency-05', 'Emergency', 'Someone is sick', 'Wani ba shi da lafiya'),
  phrase('emergency-06', 'Emergency', 'Where is the nearest hospital?', 'Ina asibitin da ya fi kusa?'),
  phrase('emergency-07', 'Emergency', 'Please stay calm', 'Don Allah ka kwantar da hankalinka'),
  phrase('emergency-08', 'Emergency', 'It is dangerous', 'Yana da hadari'),
  phrase('emergency-09', 'Emergency', 'I need a doctor', 'Ina bukatar likita'),
  phrase('emergency-10', 'Emergency', 'Do not move', 'Kada ka motsa'),
];