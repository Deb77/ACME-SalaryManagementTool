/**
 * The Help & guide content: one topic per feature, in the order a new user meets them.
 * Text may mark a control's name in **double asterisks**; it is shown in bold.
 * The screenshots come from the running app (desktop 1280 × 800, phone 390 × 844, demo data);
 * retake them when a screen changes noticeably.
 */

export type HelpIcon =
  | 'start'
  | 'find'
  | 'profile'
  | 'add'
  | 'pay'
  | 'leave'
  | 'import'
  | 'insights'
  | 'ask'
  | 'access'
  | 'faq';

export interface HelpTopic {
  /** Used in the URL: /help/<slug>. */
  slug: string;
  icon: HelpIcon;
  title: string;
  /** One line on what the feature is for. */
  lede: string;
  /** Which roles can use it, in plain words. */
  who: string;
  steps: readonly string[];
  tips: readonly string[];
  /** Screenshot file stem in ./shots (d-<stem>.jpg and m-<stem>.jpg), and what it shows. */
  shot?: { stem: string; alt: string };
  /** Questions and answers, for the Common questions topic. */
  faq?: readonly { question: string; answer: string }[];
}

export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    slug: 'getting-started',
    icon: 'start',
    title: 'Getting started',
    lede: 'Sign in and find your way around.',
    who: 'Everyone',
    steps: [
      'Open the invite link Global HR sent you and choose a password.',
      'Sign in with your work email and that password.',
      'Use the menu on the left (on a phone, the tabs at the bottom) to move between pages.',
    ],
    tips: [
      'What you see depends on your role. If a page or button is missing, your role doesn’t include it.',
      'Works on a phone, tablet or computer. Nothing to install.',
      'Forgot your password? Ask Global HR for a new sign-in link.',
    ],
    shot: { stem: 'start', alt: 'The ACME People sign-in page with email and password fields' },
  },
  {
    slug: 'find-people',
    icon: 'find',
    title: 'Find people',
    lede: 'Search and filter everyone you look after.',
    who: 'Everyone',
    steps: [
      'Go to **Employees**.',
      'Type a name, work email or employee code in the search box.',
      'Narrow the list with **Country**, **Status**, **Department** or **Job title**. **Clear filters** resets them all.',
      'Click a column title to sort, and open a person to see their profile.',
    ],
    tips: [
      'The list opens on active employees. Clear the filters to include people who have left.',
      '**Export as CSV** downloads exactly the people in the list, with your search and filters.',
    ],
    shot: { stem: 'find', alt: 'The Employees list with search, filters and the employee table' },
  },
  {
    slug: 'profile',
    icon: 'profile',
    title: 'See someone’s profile and pay history',
    lede: 'Everything about one person on one page.',
    who: 'Everyone',
    steps: [
      'Open a person from **Employees**.',
      '**Current pay** shows their salary next to the pay range for people in the same job and country.',
      '**Profile** shows their employee code, email, job, department, hire date and country.',
      '**Salary history** lists every change: when, why and how much.',
    ],
    tips: [
      'History is permanent. Old amounts are never overwritten or deleted.',
      'Amounts are always in the person’s own currency (₹ for India, £ for the UK…).',
    ],
    shot: {
      stem: 'profile',
      alt: 'An employee’s profile with current pay, profile details and salary history',
    },
  },
  {
    slug: 'add-employee',
    icon: 'add',
    title: 'Add a new joiner',
    lede: 'Create a person and their starting salary in one go.',
    who: 'Roles that can add and edit employees',
    steps: [
      'On **Employees**, choose **Add employee**.',
      'Fill in Person, Role, and Location and pay. Fields marked * are required.',
      'Check the green panel: it shows what ACME pays others in the same job and country.',
      'Choose **Save employee**.',
    ],
    tips: [
      'The employee code is created for you when you save.',
      'The currency follows the country you pick.',
      'The starting salary becomes the first line of their salary history.',
      'To fix a name, email, department or job title later, open the person and choose **Edit details**.',
    ],
    shot: {
      stem: 'add',
      alt: 'The Add employee form with Person, Role, and Location and pay sections',
    },
  },
  {
    slug: 'change-pay',
    icon: 'pay',
    title: 'Change someone’s pay',
    lede: 'Record a raise, promotion or correction with the reason.',
    who: 'Roles that can record salary changes',
    steps: [
      'Open the person and choose **Record salary change**.',
      'Enter the new annual salary and the date it starts. You’ll see their current pay and the change as a %.',
      'Pick a reason: Annual review, Promotion, Market adjustment, Correction or Other.',
      'Choose **Save change**. It appears in their salary history.',
    ],
    tips: [
      'Correction and Other ask for a short note, so the reason is clear later.',
      'Made a mistake? Record a Correction. The original entry stays visible.',
    ],
    shot: { stem: 'pay', alt: 'The Record salary change dialog over an employee’s profile' },
  },
  {
    slug: 'leavers',
    icon: 'leave',
    title: 'Record a leaver',
    lede: 'Mark someone as left without losing their records.',
    who: 'Roles that can record leavers',
    steps: [
      'Open the person and choose **Terminate**.',
      'Enter their last working day and pick a reason, such as Resignation. Add a note if it helps.',
      'Choose **Terminate** to confirm.',
    ],
    tips: [
      'Nothing is deleted. The person moves to Terminated, with their profile and pay history kept.',
      'To find leavers, set the Status filter to Terminated or clear the filters.',
    ],
    shot: {
      stem: 'leave',
      alt: 'The Terminate dialog asking for the last working day and a reason',
    },
  },
  {
    slug: 'import',
    icon: 'import',
    title: 'Import from Excel',
    lede: 'Bring in a whole sheet of people at once.',
    who: 'Roles that can import',
    steps: [
      'On **Employees**, choose **Import from Excel**.',
      'Upload your .xlsx or .csv file as it is. No template is needed: columns are matched from your headers.',
      'Review the rows: new people, updates, unchanged rows and rows that need fixing, each with the reason.',
      'Choose **Import**. Changed your mind? **Undo import** puts everything back.',
    ],
    tips: [
      'Nothing changes until you confirm the import.',
      'Each row is matched to a person by employee code, then by work email. A match updates that person; otherwise a new person is added.',
      'Country HR can only import people in their own countries.',
    ],
    shot: { stem: 'import', alt: 'The Import from Excel page with the file upload area' },
  },
  {
    slug: 'insights',
    icon: 'insights',
    title: 'Understand pay with Insights',
    lede: 'See how ACME pays people, at a glance.',
    who: 'Roles with Insights',
    steps: [
      'Go to **Insights** and pick a country, or look at all of them.',
      'Read the headline figures: active employees, annual payroll and median salary.',
      '**Pay by job title** shows the lowest, middle (median) and highest pay for each role.',
      '**Salary spread** and **Payroll by country** show the bigger picture.',
    ],
    tips: [
      'Figures cover active employees and annual base salary, each country in its own currency.',
      'The median is the middle salary: half the people earn less, half earn more.',
    ],
    shot: { stem: 'insights', alt: 'Insights with headline figures and payroll by country' },
  },
  {
    slug: 'ask-ai',
    icon: 'ask',
    title: 'Ask AI',
    lede: 'Ask a pay question in plain English and get an answer in seconds.',
    who: 'Roles with Ask AI',
    steps: [
      'Go to **Ask AI**.',
      'Type a question, for example “What do we pay Data Analysts in India compared with the US and UK?”, or pick a suggested one.',
      'Read the answer. Open the steps under it to see how it was worked out.',
      'Ask a follow-up, or start a new chat.',
    ],
    tips: [
      'Answers use only the salary data you are allowed to see.',
      'Ask AI never changes anything. If it suggests a pay change, it opens as a draft for you to review and save yourself.',
      'Always check figures before acting on them.',
    ],
    shot: { stem: 'ask', alt: 'Ask AI with suggested questions and the question box' },
  },
  {
    slug: 'access',
    icon: 'access',
    title: 'Access & roles',
    lede: 'Decide who can see and do what.',
    who: 'Global HR',
    steps: [
      'Go to **Access & roles**.',
      '**Invite person**: choose their role and countries, then copy the link and send it to them.',
      'Change someone’s role or countries with **Edit access**, or remove their access.',
      'Create or edit roles: pick what the role can do and which countries it covers.',
    ],
    tips: [
      'The invite link is shown only once. If it’s lost, create a new one.',
      'Country HR only ever sees people in their assigned countries: in lists, insights, exports, imports and Ask AI.',
      'Every access change is listed under **Recent access changes**.',
    ],
    shot: { stem: 'access', alt: 'Access & roles with the Country HR and Global HR role cards' },
  },
  {
    slug: 'questions',
    icon: 'faq',
    title: 'Common questions',
    lede: 'Quick answers to the things people ask most.',
    who: 'Everyone',
    steps: [],
    tips: [],
    faq: [
      {
        question: 'Why can’t I see some employees?',
        answer:
          'Your role may cover only some countries, and the list opens on active employees. Clear the filters, then ask Global HR if someone is still missing.',
      },
      {
        question: 'Can I delete an employee?',
        answer: 'No. Pay records must be kept, so people who leave are marked Terminated instead.',
      },
      {
        question: 'I entered the wrong salary. What now?',
        answer:
          'Record a new salary change with the reason Correction and a short note. Both entries stay in the history.',
      },
      {
        question: 'Which currency are amounts in?',
        answer:
          'Each person’s pay is in their country’s currency. Insights show each country in its own currency.',
      },
      {
        question: 'Does Ask AI change data or share it?',
        answer:
          'It only reads the data you can already see and never edits it. Suggested changes are drafts you approve yourself.',
      },
      {
        question: 'I lost my invite link.',
        answer: 'Ask Global HR to send a new one from Access & roles.',
      },
    ],
  },
];

export const helpTopicBySlug = (slug: string | undefined) =>
  HELP_TOPICS.find((topic) => topic.slug === slug);

/** Topics whose text contains every word of the query, ignoring case and ** marks. */
export function searchHelpTopics(query: string): readonly HelpTopic[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return HELP_TOPICS;
  return HELP_TOPICS.filter((topic) => {
    const text = [
      topic.title,
      topic.lede,
      ...topic.steps,
      ...topic.tips,
      ...(topic.faq ?? []).flatMap((item) => [item.question, item.answer]),
    ]
      .join(' ')
      .replaceAll('**', '')
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
