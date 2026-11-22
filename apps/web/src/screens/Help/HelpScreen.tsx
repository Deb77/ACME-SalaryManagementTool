import {
  IconChartBar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconCash,
  IconDownload,
  IconHelpCircle,
  IconLogin,
  IconLogout,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
  IconUser,
  IconUserPlus,
} from '@tabler/icons-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { AppLink, EmptyState, Logo, PillButton, SearchField } from '../../components';
import { wasSignedIn } from '../../session/signedIn';
import styles from './Help.module.css';
import {
  HELP_TOPICS,
  helpTopicBySlug,
  searchHelpTopics,
  type HelpIcon,
  type HelpTopic,
} from './helpTopics';

const shots = import.meta.glob<string>('./shots/*.jpg', { eager: true, import: 'default' });
const shotUrl = (kind: 'd' | 'm', stem: string) => shots[`./shots/${kind}-${stem}.jpg`];

const ICONS: Record<HelpIcon, (size: number) => ReactNode> = {
  start: (size) => <IconLogin size={size} />,
  find: (size) => <IconSearch size={size} />,
  profile: (size) => <IconUser size={size} />,
  add: (size) => <IconUserPlus size={size} />,
  pay: (size) => <IconCash size={size} />,
  leave: (size) => <IconLogout size={size} />,
  import: (size) => <IconDownload size={size} />,
  insights: (size) => <IconChartBar size={size} />,
  ask: (size) => <IconSparkles size={size} />,
  access: (size) => <IconShieldCheck size={size} />,
  faq: (size) => <IconHelpCircle size={size} />,
};

function TopicIcon({ icon, size = 20, large }: { icon: HelpIcon; size?: number; large?: boolean }) {
  return (
    <span aria-hidden="true" className={large ? `${styles.icon} ${styles.iconLarge}` : styles.icon}>
      {ICONS[icon](size)}
    </span>
  );
}

/** Help text with control names marked as **Name**, shown in bold. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\*\*(.+?)\*\*/)
        .map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part))}
    </>
  );
}

/**
 * Help & guide, a public page: it opens without signing in, so a link to it can be shared with
 * anyone. `/help` lists the topics; `/help/<topic>` shows one topic with a screenshot, the steps
 * and tips.
 */
export function HelpScreen() {
  const { topic: slug } = useParams();
  const topic = slug === undefined ? undefined : helpTopicBySlug(slug);

  useEffect(() => {
    document.title = topic ? `${topic.title} · Help · ACME People` : 'Help & guide · ACME People';
    window.scrollTo?.(0, 0);
  }, [topic]);

  return (
    <div className={styles.page}>
      <a href="#help-content" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.bar}>
        <AppLink href="/help" className={styles.brand}>
          <Logo size={30} />
          <span>
            ACME People <span className={styles.brandSub}>Help &amp; guide</span>
          </span>
        </AppLink>
        {wasSignedIn() ? (
          <PillButton href="/" size="small">
            Back to ACME People
          </PillButton>
        ) : (
          <PillButton href="/sign-in" size="small" tone="primary">
            Sign in
          </PillButton>
        )}
      </header>
      <main
        id="help-content"
        tabIndex={-1}
        className={topic ? `${styles.panel} ${styles.panelTopic}` : styles.panel}
      >
        {slug === undefined ? (
          <Landing />
        ) : topic ? (
          <TopicView key={topic.slug} topic={topic} />
        ) : (
          <EmptyState
            title="That help topic doesn’t exist"
            description="The link may be old or mistyped."
            action={<AppLink href="/help">See all help topics</AppLink>}
          />
        )}
      </main>
    </div>
  );
}

function Landing() {
  const [query, setQuery] = useState('');
  const topics = searchHelpTopics(query);
  const link = (slug: string) => {
    const topic = helpTopicBySlug(slug)!;
    return <AppLink href={`/help/${slug}`}>{topic.title}</AppLink>;
  };
  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Help &amp; guide</h1>
          <p className={styles.lead}>
            Pick a topic to see how it works, step by step, with screenshots.
          </p>
        </div>
        <div className={styles.search}>
          <SearchField
            label="Search the guide"
            placeholder="Search the guide, e.g. “undo import”"
            value={query}
            onChange={setQuery}
          />
        </div>
      </div>
      {query.trim() === '' && (
        <p className={styles.newHere}>
          <strong>New here?</strong> Start with {link('getting-started')}, then{' '}
          {link('find-people')} and {link('change-pay')}.
        </p>
      )}
      {topics.length > 0 ? (
        <ul className={styles.cards} aria-label="Help topics">
          {topics.map((topic) => (
            <li key={topic.slug}>
              <AppLink href={`/help/${topic.slug}`} className={styles.card}>
                <TopicIcon icon={topic.icon} />
                <span className={styles.cardTitle}>{topic.title}</span>
                <span className={styles.cardLede}>{topic.lede}</span>
                <span className={styles.cardMore} aria-hidden="true">
                  {topic.faq ? 'Read answers' : `${topic.steps.length} steps`}
                  <IconChevronRight size={14} />
                </span>
              </AppLink>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nothing matches that search"
          description="Try other words, such as “salary”, “import” or “roles”."
        />
      )}
    </>
  );
}

function TopicView({ topic }: { topic: HelpTopic }) {
  const index = HELP_TOPICS.indexOf(topic);
  const previous = HELP_TOPICS[index - 1];
  const next = HELP_TOPICS[index + 1];
  return (
    <div className={styles.topicLayout}>
      <nav aria-label="Help topics" className={styles.side}>
        <AppLink href="/help" className={styles.back}>
          <IconChevronLeft size={16} aria-hidden="true" />
          All topics
        </AppLink>
        <ul className={styles.sideList}>
          {HELP_TOPICS.map((item) => (
            <li key={item.slug}>
              <AppLink
                href={`/help/${item.slug}`}
                className={styles.sideLink}
                aria-current={item === topic ? 'page' : undefined}
              >
                <span aria-hidden="true" className={styles.sideIcon}>
                  {ICONS[item.icon](16)}
                </span>
                {item.title}
              </AppLink>
            </li>
          ))}
        </ul>
      </nav>
      <article className={styles.article} aria-labelledby="help-topic-title">
        {/* On desktop only this part scrolls; the pager below stays pinned. */}
        <div className={styles.articleBody}>
          <div className={styles.topicHead}>
            <TopicIcon icon={topic.icon} size={22} large />
            <div className={styles.topicHeadText}>
              <h1 id="help-topic-title" className={styles.topicTitle}>
                {topic.title}
              </h1>
              <p className={styles.lead}>{topic.lede}</p>
            </div>
            <span className={styles.who}>Who: {topic.who}</span>
          </div>

          {topic.shot && (
            <figure className={styles.shot}>
              <picture>
                <source media="(min-width: 768px)" srcSet={shotUrl('d', topic.shot.stem)} />
                <img
                  src={shotUrl('m', topic.shot.stem)}
                  alt={topic.shot.alt}
                  className={styles.shotImage}
                />
              </picture>
              <figcaption className={styles.shotCaption}>Screenshot from ACME People</figcaption>
            </figure>
          )}

          {topic.steps.length > 0 && (
            <div className={styles.howTo}>
              <section aria-labelledby="help-steps">
                <h2 id="help-steps" className={styles.sectionLabel}>
                  How to
                </h2>
                <ol className={styles.steps}>
                  {topic.steps.map((step) => (
                    <li key={step} className={styles.step}>
                      <RichText text={step} />
                    </li>
                  ))}
                </ol>
              </section>
              {topic.tips.length > 0 && (
                <section aria-labelledby="help-tips" className={styles.tips}>
                  <h2 id="help-tips" className={styles.tipsLabel}>
                    Good to know
                  </h2>
                  <ul className={styles.tipList}>
                    {topic.tips.map((tip) => (
                      <li key={tip} className={styles.tip}>
                        <IconCheck size={16} aria-hidden="true" className={styles.tick} />
                        <span>
                          <RichText text={tip} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {topic.faq && (
            <div className={styles.faq}>
              {topic.faq.map((item, itemIndex) => (
                <details key={item.question} className={styles.question} open={itemIndex === 0}>
                  <summary className={styles.questionTitle}>{item.question}</summary>
                  <p className={styles.answer}>{item.answer}</p>
                </details>
              ))}
            </div>
          )}
        </div>

        <nav aria-label="More help topics" className={styles.pager}>
          {previous ? (
            <AppLink href={`/help/${previous.slug}`} className={styles.pagerLink}>
              <span className={styles.pagerHint}>‹ Previous</span>
              {previous.title}
            </AppLink>
          ) : (
            <span />
          )}
          {next && (
            <AppLink
              href={`/help/${next.slug}`}
              className={`${styles.pagerLink} ${styles.pagerNext}`}
            >
              <span className={styles.pagerHint}>Next ›</span>
              {next.title}
            </AppLink>
          )}
        </nav>
      </article>
    </div>
  );
}
