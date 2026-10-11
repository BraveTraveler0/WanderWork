// Starter articles for the blog at wanderwork.io/blog. Each one is inserted once, the
// first time the server sees that its slug is missing. Admins can edit or delete
// them from the blog page, and a deleted starter article is not re-created.
const SEED_POSTS = [
  {
    slug: 'is-that-remote-job-actually-remote',
    category: 'Remote Work',
    title: 'Is that remote job actually remote? How to read the fine print',
    excerpt: 'A listing can say "remote" and still require you to live in one state, keep East Coast hours, or come in twice a week. Here is how to tell what kind of remote you are really applying for.',
    body: `"Remote" is one of the least precise words in hiring. Two listings can carry the same label and describe completely different lives. One lets you work from anywhere with a good connection. The other expects you at a desk in a specific state, online from nine to five Eastern, with a trip to headquarters every quarter.

Neither is wrong, but you should know which one you are applying for before you spend an evening on the application.

The five kinds of remote

Most remote jobs fall into one of a few groups. Worldwide roles hire from almost any country. Country-restricted roles, most often US-only or Canada-only, are remote inside one country for tax and legal reasons. Timezone roles let you live where you like as long as you overlap with a region such as Europe or Latin America. Hybrid roles are remote some days and in an office on others. Async-friendly roles care about what you deliver more than when you are online.

Where the restrictions hide

The headline rarely tells you. Look further down for phrases like "must be authorized to work in", "must reside in", "core hours", "occasional travel to", or a list of states where the company is registered. Salary ranges tied to a location are another signal that the company hires in specific places.

If the listing is silent, check the careers page for the company's hiring countries, and ask the recruiter in your first message. It is a normal question and it saves both of you time.

How Wander/Work handles it

Every job on Wander/Work is tagged with its real remote type: worldwide, US-only, Canada, Europe timezone, LATAM timezone, hybrid, or async-friendly. Job pages also show allowed countries and timezone requirements when the employer states them, along with salary when it is available. You can filter on those tags instead of opening forty listings to find the six that fit how you live.

Remote should describe your actual week, not just the word in the title. Read the fine print first, then apply.`,
    image: 'beach-laptop',
    publishedAt: new Date('2026-10-08T12:00:00Z'),
  },
  {
    slug: 'tailor-your-resume-to-every-job',
    category: 'Resumes',
    title: 'Why one resume is not enough, and how to tailor it without losing a weekend',
    excerpt: 'Sending the same resume to fifty jobs feels efficient. It usually is not. A resume shaped around one posting does more work than a general one sent everywhere.',
    body: `Most people write one resume, polish it, and send it everywhere. It makes sense. Rewriting a resume for every job sounds like a second full-time job.

The trouble is that a general resume asks the reader to do the matching for you. A hiring manager with two hundred applications will not hunt for the line that proves you fit. Many companies also run applications through an applicant tracking system first, and those systems look for the skills and terms that appear in the posting.

What tailoring really means

Tailoring is not inventing experience. It is choosing which true things to put first. Start with the posting and pull out the handful of requirements it repeats or lists at the top. Then make sure your resume answers each one in plain view.

Use the employer's wording where it honestly applies. If they say "customer onboarding" and you wrote "client implementation", use their phrase. Move the most relevant role or project higher. Cut bullet points that have nothing to do with this job, even if you are proud of them. Put numbers on the results that matter for this role.

What to leave alone

Do not rewrite your job titles, dates, or anything you could not explain in an interview. A tailored resume should still be recognizably yours. If a requirement is a real gap, a short honest line in the cover letter beats a stretched claim on the resume.

Letting AI do the first pass

This is the part of the job search that Wander/Work was built to shorten. You upload your base resume once. For any job on the platform, the resume tool reads the posting and returns a version of your resume shaped around that role's requirements and keywords. The cover letter tool does the same for a targeted letter. Both use tokens, and both give you a draft to review, edit, and send as your own.

The goal is not more applications. It is better ones. Ten applications that clearly fit will usually beat a hundred that make the reader guess.`,
    image: 'paper-chaos',
    publishedAt: new Date('2026-10-01T12:00:00Z'),
  },
  {
    slug: 'stop-applying-into-the-void',
    category: 'Job Search',
    title: 'Stop applying into the void: a simple case for emailing the recruiter',
    excerpt: 'You hit submit and hear nothing for three weeks. A short, specific note to the right person at the company can change that. Here is what to say and what to avoid.',
    body: `Everyone who has looked for work recently knows the feeling. You find a role that fits, spend an hour on the application, press submit, and then nothing. No reply, no rejection, just silence.

The application portal is one door into a company. It is also the most crowded one. A direct, polite message to the person doing the hiring is a second door, and far fewer people use it.

Why it works

Recruiters and hiring managers are busy people trying to fill a role. A short note that shows you read the posting and can do the job makes their work easier. It also puts a name and a reason next to an application that would otherwise be one row in a long list.

It does not replace applying. Apply first, then write.

What a good note looks like

Keep it under a hundred and fifty words. Say which role you applied for. Give two or three specifics that connect your experience to what the posting asks for. Mention one real thing about the company that drew you to it. End with a simple, low-pressure ask, such as whether they are the right person to speak with about the role.

What to avoid

Do not paste your whole resume into the message. Do not send the same paragraph to ten people at one company. Do not follow up every other day. One follow-up after about a week is reasonable. After that, let it go and put your energy into the next role.

Finding the right person

The hard part is knowing who to write to. On Wander/Work, jobs are tagged when a recruiter contact is available. The recruiter outreach tool identifies the likely hiring contact at the company and drafts a personalized email based on your profile and the posting. You read it, change anything that does not sound like you, and send it yourself. Nothing goes out without your review.

A thoughtful message will not win every time. It will get you more replies than silence does.`,
    image: 'frustrated',
    publishedAt: new Date('2026-09-24T12:00:00Z'),
  },
  {
    slug: 'working-while-traveling-what-to-look-for',
    category: 'Digital Nomads',
    title: 'Working while you travel: what to look for in a job before you book the flight',
    excerpt: 'Plenty of remote jobs stop being workable the moment you cross a border or a few time zones. These are the questions to settle before you plan a life around one.',
    body: `The picture of the laptop on the beach is appealing, and for some people it is close to real. For many others, the remote job they already have would not survive a move three time zones away.

If you want to travel while you work, the job has to be chosen for it. Here is what to look at.

Where you are allowed to be

Start with the legal question. Many remote employers can only hire people who live in certain countries, and some limit how long you can work from abroad. Look for worldwide roles, or roles that name the regions they hire in. If a posting does not say, ask before you accept, not after you land.

When you have to be online

Time zones decide what your days look like. A role with fixed core hours in New York means late evenings from Lisbon and very early mornings from Bali. Roles described as async-friendly, with written updates and few standing meetings, give you far more room. Count the hours of overlap a team expects and decide if you can live with them for months, not just a week.

How the team actually works

Ask how decisions get made. Teams that write things down, record meetings, and judge work by results tend to suit people on the move. Teams that rely on quick calls and being instantly reachable usually do not, whatever the listing says.

The practical side

Reliable internet matters more than the view. Have a backup, such as a phone hotspot or a coworking space, anywhere you plan to stay. Check what your employer provides for equipment and whether they have rules on public networks. Sort out health cover and understand your tax position, since both can change when you spend long stretches abroad.

How to search for it

Wander/Work has a dedicated digital nomad job board for location-flexible, async-friendly, and worldwide roles. Each job also carries a Remote Fit score and a Digital Nomad Fit score, so you can see at a glance how travel-friendly a role really is before you read the full posting.

Pick the job for the life you want first. The flight is the easy part.`,
    image: 'mountain-creator',
    publishedAt: new Date('2026-09-17T12:00:00Z'),
  },
  {
    slug: 'how-ai-job-matching-works',
    category: 'AI Job Search',
    title: 'How AI job matching works, and how to get better matches from it',
    excerpt: 'Job matching is not magic. It compares what you have told it about yourself with what each posting asks for. The more it knows, the better your list gets.',
    body: `Scrolling a job board is slow because most of what you see is not for you. Keyword search helps a little, but it misses good roles with unusual titles and returns plenty of bad ones that happen to share a word.

Matching takes a different approach. Instead of asking you to search, it reads your profile and every open job, then ranks the jobs by how well they fit.

What goes into a match

On Wander/Work, matching looks at your full profile: your resume, your skills, your experience, and the preferences you set, such as target titles and seniority. Each job in the database is scored against that profile, and the best fits rise to the top of your dashboard. Jobs are refreshed every six hours from company hiring systems including Greenhouse, Lever, Ashby, SmartRecruiters, Workable, and Jobvite, so new roles are matched soon after they are posted.

Because the comparison is based on meaning rather than exact words, a "Customer Success Manager" profile can surface an "Account Manager, Onboarding" role that a keyword search would have skipped.

How to get better results

Upload a current resume. Matching can only work with what it has, and an outdated resume produces outdated matches.

Be specific about target titles. Two or three clear titles do more than a long list of everything you might consider.

List your real skills, including tools. If you use a specific platform or language every day, name it.

Set your seniority honestly. Aiming a level too high or too low fills your list with roles you will not get or do not want.

Update your profile when your goals change. If you decide to move from support into operations, tell the system, or it will keep sending you support roles.

What matching cannot do

A score is a starting point, not a verdict. It cannot tell if you will like the manager or the product. Read the posting, check the remote details, and trust your own judgment on fit.

Matching is included on the free plan. The point is to spend your time on the ten roles worth applying to instead of the three hundred that are not.`,
    image: 'beach-creator',
    publishedAt: new Date('2026-09-10T12:00:00Z'),
  },
]

// Slugs of the original placeholder posts. Any that were never edited are retired
// when the starter articles above are installed.
const RETIRED_SAMPLE_SLUGS = [
  'build-your-audience-anywhere',
  'own-your-platform',
  'sell-directly-to-your-fans',
  'when-the-algorithm-changes',
  'digital-goods-that-stand-out',
]

module.exports = { SEED_POSTS, RETIRED_SAMPLE_SLUGS }
