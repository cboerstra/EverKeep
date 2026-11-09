export default (function catalog(){
const paths = {
  logo:'M12 2v20M2 12h20M5 5l14 14M19 5 5 19',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  user:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  chat:'M21 11.5a8.4 8.4 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 4a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8zM8 11h8m-8 4h5',
  book:'M4 19V5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1 0-4h14M8 7h8m-8 4h6',
  folder:'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  sparkle:'M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5zM19 3v4m-2-2h4',
  avatar:'M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3m0 8v3a1 1 0 0 1-1 1h-3m-8 0H5a1 1 0 0 1-1-1v-3m5-6v1m6-1v1m-5 4a3 3 0 0 0 4 0',
  shield:'M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10zm-3-10 2 2 4-4',
  people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7-7.9a4 4 0 0 1 0 7.8',
  lock:'M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm2 0V7a4 4 0 1 1 8 0v3m-4 4v3',
  right:'m9 18 6-6-6-6', arrow:'M4 12h15m-6-6 6 6-6 6',
  up:'M7 17 17 7M7 7h10v10', plus:'M12 5v14M5 12h14',
  play:'m8 5 12 7-12 7z', upload:'M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4',
  check:'m5 12 4 4L19 6', clock:'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  file:'M6 3h8l5 5v13H6zM14 3v6h5m-9 4h5m-5 4h5',
  mic:'M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm-6-4v1a6 6 0 0 0 12 0v-1m-6 7v3m-3 0h6',
  menu:'M4 6h16M4 12h16M4 18h16', close:'m6 6 12 12M6 18 18 6', info:'M12 11v5m0-8h.01m9 4a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  image:'M3 5h18v14H3zm1 12 5-5 4 4 2-2 5 5M16 9h.01', heart:'M20.8 8.4c0 4.5-8.8 9.6-8.8 9.6S3.2 12.9 3.2 8.4a4.4 4.4 0 0 1 8.8-.6 4.4 4.4 0 0 1 8.8.6z'
};
const nav = [
  ['STUDIO',[['dashboard','Dashboard','grid'],['profile','My profile','user'],['discovery','Guided discovery','chat'],['library','Q&A library','book'],['archive','Documents & media','folder'],['traits','Personality & traits','sparkle'],['avatar','Avatar & voice','avatar']]],
  ['CONTROL',[['privacy','Privacy & sharing','shield'],['shared','Shared with me','people']]]
];
const topics = {
  'Life stories': ['What is a moment that changed the way you saw yourself?', 'Where did you feel most at home growing up?', 'What ordinary day would you like to relive?', 'What is a choice that took your life in an unexpected direction?'],
  'People & relationships': ['Who made you feel understood, and what did they do?', 'What is a tradition you shared with someone you love?', 'How has your idea of friendship changed over time?'],
  'Values & beliefs': ['What principle has stayed with you through difficult times?', 'When did you change your mind about something important?', 'What do you hope people learn from the way you live?'],
  'Everyday details': ['What would a perfect ordinary morning look like for you?', 'Which songs, scents, or foods take you somewhere else?', 'What is something you say often without thinking?'],
  'Messages for the future': ['What would you like someone you love to hear from you in ten years?', 'What would you tell a younger person facing the same choice you once faced?', 'What would you like to be remembered for?']
};
const traitOptions=['Curious','Warm','Reflective','Practical','Playful','Direct','Patient','Adventurous','Reserved','Optimistic','Empathetic','Dry humor','Loyal','Creative'];
const statusNames={draft:'Not started',review:'Needs review',complete:'Complete'};
const kindIcons={profile:'user',traits:'sparkle',avatar:'avatar',settings:'shield',answer:'chat',asset:'file',preset:'people'};
const sectionTitles=Object.fromEntries(nav.flatMap(([,items])=>items.map(([id,title])=>[id,title])));
const fileTypes='image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/ogg,audio/webm,video/mp4,video/webm,video/quicktime,.pdf,.docx,.txt,.csv';
return {paths,nav,topics,traitOptions,statusNames,kindIcons,sectionTitles,fileTypes};
})();
