'use strict'

// Server-rendered HTML, Markdown and RSS for the public blog at wanderwork.io/blog.
// These pages are written for search engines and AI crawlers first: all content
// is in the initial HTML, with structured data, and no JavaScript is required.

const { HERO_IMAGE, resolveBlogImage } = require('../config/blogImages')

const APP_URL = 'https://wanderwork.io'
const BACKEND_URL = process.env.BACKEND_URL || 'https://wanderwork-backend-server.onrender.com'
const BLOG_PATH = '/blog'
const BLOG_URL = `${APP_URL}${BLOG_PATH}`
const FEED_URL = `${APP_URL}/feeds/blog.xml`
const BLOG_NAME = 'Wander/Work Blog'
const BLOG_TITLE = 'Remote Work and AI Job Search Blog | WanderWork'
const BLOG_DESCRIPTION = 'Practical guides on finding remote jobs, working while traveling, tailoring your resume, reaching recruiters, and using AI in your job search.'
const ROBOTS = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'

const PRODUCT_LINKS = [
  { href: '/remote-jobs', label: 'Browse remote jobs' },
  { href: '/digital-nomad-jobs', label: 'Digital nomad jobs' },
  { href: '/work-from-home-jobs', label: 'Work from home jobs' },
  { href: '/ai-job-search', label: 'AI job matching' },
  { href: '/resume-cover-letter-ai', label: 'AI resume and cover letter builder' },
]

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// JSON-LD goes inside a <script> tag, so "<" must not be able to close it.
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

const postUrl = (post) => `${BLOG_URL}/${encodeURIComponent(post.slug)}`
const isoDate = (d) => new Date(d).toISOString()
const longDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// Blank lines separate blocks. A short single line with no closing punctuation is a subheading.
function bodyBlocks(body) {
  return String(body || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((text) => ({
    text,
    heading: text.length <= 70 && !text.includes('\n') && !/[.!?:,;"]$/.test(text),
  }))
}

const wordCount = (post) => String(post.body || '').split(/\s+/).filter(Boolean).length
const readingMinutes = (post) => Math.max(1, Math.round(wordCount(post) / 220))

const publisher = {
  '@type': 'Organization',
  '@id': `${APP_URL}/#organization`,
  name: 'WanderWork',
  url: APP_URL,
  logo: { '@type': 'ImageObject', url: `${APP_URL}/favicon.svg` },
}

function head({ title, description, canonical, image, ogType, extraMeta = '', schemas = [] }) {
  return `<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}"/>
<meta name="robots" content="${ROBOTS}"/>
<link rel="canonical" href="${esc(canonical)}"/>
<link rel="alternate" type="application/rss+xml" title="${esc(BLOG_NAME)}" href="${FEED_URL}"/>
<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
<meta property="og:type" content="${ogType}"/>
<meta property="og:site_name" content="WanderWork"/>
<meta property="og:locale" content="en_US"/>
<meta name="author" content="WanderWork"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:url" content="${esc(canonical)}"/>
<meta property="og:image" content="${esc(image.url)}"/>
${image.width ? `<meta property="og:image:width" content="${image.width}"/>\n<meta property="og:image:height" content="${image.height}"/>` : ''}
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="twitter:image" content="${esc(image.url)}"/>
${extraMeta}
${schemas.map(jsonLd).join('\n')}
<script async src="https://www.googletagmanager.com/gtag/js?id=G-WBD1D6JH1M"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-WBD1D6JH1M');</script>
<style>${CSS}</style>`
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Manrope,system-ui,-apple-system,"Segoe UI",sans-serif;background:#fff;color:#333;line-height:1.6}
a{color:#306770;text-decoration:none}a:hover{text-decoration:underline}
img{max-width:100%;height:auto;display:block}
.wrap{max-width:1100px;margin:0 auto;padding:0 20px}
.hero{position:relative;background:#16333a url(/blog-images/${HERO_IMAGE.file}) center/cover;color:#fff}
.hero:before{content:"";position:absolute;inset:0;background:rgba(0,0,0,.5)}
.hero .wrap{position:relative}
.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px}
.nav a{color:#fff}.nav .brand{letter-spacing:3px}.nav .links{display:flex;align-items:center;gap:20px}
.nav .cta{background:#306770;padding:8px 16px;border-radius:3px}
.hero-title{text-align:center;padding:56px 0 80px}
.hero-title .big{font-size:32px;font-weight:500;line-height:1.25}
.hero-title p{margin-top:10px;font-size:13px;opacity:.9;max-width:620px;margin-left:auto;margin-right:auto}
.crumbs{margin-top:12px;font-size:11px}.crumbs a{color:#fff}
.layout{display:grid;grid-template-columns:minmax(0,1fr);gap:40px;padding-top:40px;padding-bottom:40px}
@media(min-width:1000px){.layout{grid-template-columns:minmax(0,1fr) 260px}aside{padding-left:24px;border-left:1px solid #ededed}}
.card{display:flex;flex-direction:column;gap:20px;padding-bottom:28px;margin-bottom:28px;border-bottom:1px solid #ededed}
@media(min-width:640px){.card{flex-direction:row;gap:32px}.card .thumb{width:45%;flex-shrink:0}}
.card .thumb img{width:100%;height:210px;object-fit:cover}
.cat{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#306770}
.card h2{margin-top:8px;font-size:19px;line-height:1.35}.card h2 a{color:#333}
.card p{margin-top:12px;font-size:13px;color:#666;line-height:1.8}
.meta{margin-top:14px;padding-top:12px;border-top:1px solid #ededed;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:#8a8a8a;display:flex;justify-content:space-between;gap:12px}
article.post h1{margin-top:8px;font-size:28px;line-height:1.3;color:#222}
article.post .lead-img{width:100%;max-height:440px;object-fit:cover;margin-bottom:24px}
article.post h2{margin-top:32px;font-size:19px;color:#222}
article.post p{margin-top:18px;font-size:15px;color:#444;line-height:1.85}
article.post .summary{font-size:16px;color:#333}
.box{margin-top:36px;padding:20px 24px;background:#f1f7f8;border:1px solid #dce9eb;border-radius:6px}
.box h2{margin:0 0 8px;font-size:15px;color:#306770}.box ul{list-style:none}.box li{padding:5px 0;font-size:14px}
aside section{margin-bottom:40px}
aside h2{font-size:13px;font-weight:600;margin-bottom:16px;padding-left:12px;border-left:2px solid #306770;line-height:14px}
aside ul{list-style:none;font-size:12px}aside li{padding:10px 0;border-top:1px solid #ededed}aside li:last-child{border-bottom:1px solid #ededed}aside li a{color:#555}
aside p{font-size:12px;color:#666;line-height:1.7;margin-bottom:12px}
.news{display:flex;gap:8px;padding:6px;border:1px solid #e3e3e3}
.news input{flex:1;min-width:0;border:0;outline:0;padding:6px 8px;font-size:12px;background:#fff;color:#333}
.news button{border:0;background:#306770;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;padding:8px 16px;border-radius:3px;cursor:pointer}
.note{margin-top:8px;font-size:11px;color:#306770}
.adminbar{background:#f1f7f8;border-bottom:1px solid #dce9eb;color:#306770;font-size:12px;font-weight:600}
.adminbar .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:12px;padding-bottom:12px}
.adminbar .btn{background:#306770;color:#fff;padding:7px 14px;border-radius:3px;font-weight:700}
.adminbar .btn.alt{background:none;color:#306770;border:1px solid #306770;margin-right:8px}
.tools{display:flex;gap:8px;margin-bottom:12px;font-size:11px;font-weight:600}
.tools a,.tools button{font:inherit;background:#fff;cursor:pointer;padding:4px 10px;border:1px solid #306770;border-radius:3px;color:#306770}
.tools button{border-color:#c0392b;color:#c0392b}
footer{border-top:1px solid #ededed;padding:24px 0 40px;font-size:12px;color:#8a8a8a;text-align:center}
footer a{margin:0 8px}
`

function hero({ heading, sub, crumbs }) {
  return `<header class="hero"><div class="wrap">
<nav class="nav" aria-label="Main">
  <a class="brand" href="${APP_URL}/">WANDER/WORK</a>
  <span class="links"><a href="${APP_URL}/remote-jobs">Remote Jobs</a><a href="${BLOG_URL}">Blog</a><a id="signin" href="${APP_URL}/?login=true" rel="nofollow">Sign In</a><a class="cta" id="signup" href="${APP_URL}/?signup=true">Sign Up</a></span>
</nav>
<div class="hero-title">
  ${heading}
  ${sub ? `<p>${esc(sub)}</p>` : ''}
  <nav class="crumbs" aria-label="Breadcrumb">${crumbs}</nav>
</div>
</div></header>`
}

function sidebar(posts) {
  return `<aside>
<section>
  <h2>Recent Posts</h2>
  <ul>${posts.slice(0, 8).map((p) => `<li><a href="${postUrl(p)}">${esc(p.title)}</a></li>`).join('')}</ul>
</section>
<section>
  <h2>Newsletter</h2>
  <p>Get the latest remote work and job search articles delivered to your email a few times a month.</p>
  <form class="news" id="newsletter"><input type="email" name="email" required placeholder="Your Email" aria-label="Your email"/><button type="submit">Go</button></form>
  <p class="note" id="newsletter-note" role="status"></p>
</section>
<section>
  <h2>Find Remote Work</h2>
  <ul>${PRODUCT_LINKS.map((l) => `<li><a href="${APP_URL}${l.href}">${l.label}</a></li>`).join('')}</ul>
</section>
</aside>`
}

// Sign-in link and admin tools. The HTML is cached and identical for every visitor,
// so the tools are added in the browser, and only after the server confirms the
// signed-in account may edit the blog. Crawlers never see them.
const ADMIN_SCRIPT = `<script>
(function(){
var signin=document.getElementById('signin');if(!signin)return;
signin.href='${APP_URL}/?login=true&next='+encodeURIComponent(location.pathname);
var token;try{token=localStorage.getItem('wanderworkToken')}catch(e){}
if(!token)return;
var auth={Authorization:'Bearer '+token};
fetch('${BACKEND_URL}/blog/posts',{headers:auth}).then(function(r){return r.json()}).then(function(data){
if(!data.signedIn)return;
signin.textContent='Dashboard';signin.href='${APP_URL}/';
var signup=document.getElementById('signup');if(signup)signup.style.display='none';
if(!data.canEdit)return;
var bar=document.createElement('div');bar.className='adminbar';
bar.innerHTML='<div class="wrap"><span>Admin view. You can add, edit, and delete posts.</span><span><a class="btn alt" href="${BLOG_PATH}/admin">Manage all</a><a class="btn" href="${BLOG_PATH}/admin?new=1">New post</a></span></div>';
var hero=document.querySelector('.hero');hero.parentNode.insertBefore(bar,hero.nextSibling);
Array.prototype.forEach.call(document.querySelectorAll('[data-post-id]'),function(el){
var tools=document.createElement('div');tools.className='tools';
var edit=document.createElement('a');edit.textContent='Edit';edit.href='${BLOG_PATH}/admin/'+encodeURIComponent(el.getAttribute('data-slug'))+'?edit=1';
var del=document.createElement('button');del.type='button';del.textContent='Delete';
del.addEventListener('click',function(){
if(!confirm('Delete "'+el.getAttribute('data-title')+'"? It will be removed from the blog.'))return;
del.disabled=true;
fetch('${BACKEND_URL}/blog/posts/'+el.getAttribute('data-post-id'),{method:'DELETE',headers:auth}).then(function(r){
return r.json().then(function(j){if(!r.ok)throw new Error(j.message||'Could not delete the post.');
if(el.className==='card')el.parentNode.removeChild(el);else location.href='${BLOG_PATH}/admin'})})
.catch(function(err){del.disabled=false;alert(err.message||'Could not delete the post.')})});
tools.appendChild(edit);tools.appendChild(del);
var target=el.className==='card'?el.lastElementChild:el;target.insertBefore(tools,target.firstChild);
});
}).catch(function(){});
})();
</script>`

const FOOTER = `<footer><div class="wrap">
<p><a href="${APP_URL}/">WanderWork</a><a href="${APP_URL}/remote-jobs">Remote Jobs</a><a href="${APP_URL}/about">About</a><a href="${APP_URL}/privacy">Privacy</a><a href="${APP_URL}/terms">Terms</a><a href="${FEED_URL}">RSS</a><a href="${BLOG_URL}/admin" rel="nofollow">Admin</a></p>
<p style="margin-top:8px">&copy; 2026 Wander/Work, Inc.</p>
</div></footer>
<script>
document.getElementById('newsletter').addEventListener('submit',function(e){e.preventDefault();var n=document.getElementById('newsletter-note');var f=e.target;
fetch('${BACKEND_URL}/blog/newsletter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.email.value})})
.then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.message||'Could not sign you up.');n.textContent='Thanks. You are on the list.';f.reset()})})
.catch(function(err){n.textContent=err.message||'Could not sign you up. Please try again.'})});
</script>
${ADMIN_SCRIPT}`

function imgTag(post, { className = '', eager = false } = {}) {
  const image = resolveBlogImage(post.image, APP_URL)
  const size = image.width ? ` width="${image.width}" height="${image.height}"` : ''
  // Same-origin path for our own images; absolute URLs are only needed in meta tags and JSON-LD.
  const src = image.url.startsWith(`${APP_URL}/`) ? image.url.slice(APP_URL.length) : image.url
  return `<img${className ? ` class="${className}"` : ''} src="${esc(src)}" alt="${esc(post.title)}"${size} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"/>`
}

// Lets the admin tools know which post an element shows.
const adminAttrs = (post) => ` data-post-id="${esc(post._id)}" data-slug="${esc(post.slug)}" data-title="${esc(post.title)}"`

function blogIndexHtml(posts) {
  const heroImage = { url: `${APP_URL}/blog-images/${HERO_IMAGE.file}`, width: HERO_IMAGE.width, height: HERO_IMAGE.height }
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      '@id': `${BLOG_URL}#blog`,
      name: BLOG_NAME,
      description: BLOG_DESCRIPTION,
      url: BLOG_URL,
      inLanguage: 'en',
      publisher,
      blogPost: posts.map((p) => ({
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.excerpt,
        url: postUrl(p),
        datePublished: isoDate(p.publishedAt),
        dateModified: isoDate(p.updatedAt || p.publishedAt),
        image: resolveBlogImage(p.image, APP_URL).url,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${APP_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: BLOG_URL },
      ],
    },
  ]

  const cards = posts.map((p, i) => `<article class="card"${adminAttrs(p)}>
  <a class="thumb" href="${postUrl(p)}">${imgTag(p, { eager: i === 0 })}</a>
  <div>
    ${p.category ? `<span class="cat">${esc(p.category)}</span>` : ''}
    <h2><a href="${postUrl(p)}">${esc(p.title)}</a></h2>
    <p>${esc(p.excerpt)}</p>
    <div class="meta"><span>${readingMinutes(p)} min read</span><time datetime="${isoDate(p.publishedAt)}">${longDate(p.publishedAt)}</time></div>
  </div>
</article>`).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
${head({ title: BLOG_TITLE, description: BLOG_DESCRIPTION, canonical: BLOG_URL, image: heroImage, ogType: 'website', schemas })}
</head>
<body>
${hero({
    heading: '<h1 class="big">Remote Work and Job Search Blog</h1>',
    sub: BLOG_DESCRIPTION,
    crumbs: `<a href="${APP_URL}/">Home</a> &gt; Blog`,
  })}
<div class="wrap layout">
<main>
${cards || '<p>No posts yet. Check back soon.</p>'}
</main>
${sidebar(posts)}
</div>
${FOOTER}
</body>
</html>`
}

function blogPostHtml(post, allPosts) {
  const url = postUrl(post)
  const image = resolveBlogImage(post.image, APP_URL)
  const blocks = bodyBlocks(post.body)
  const description = post.excerpt || blocks.find((b) => !b.heading)?.text.slice(0, 300) || BLOG_DESCRIPTION
  const others = allPosts.filter((p) => p.slug !== post.slug).slice(0, 4)

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      '@id': `${url}#article`,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      headline: post.title,
      description,
      image: [image.url],
      datePublished: isoDate(post.publishedAt),
      dateModified: isoDate(post.updatedAt || post.publishedAt),
      author: publisher,
      publisher,
      ...(post.category ? { articleSection: post.category } : {}),
      wordCount: wordCount(post),
      articleBody: blocks.map((b) => b.text).join('\n\n'),
      inLanguage: 'en',
      isAccessibleForFree: true,
      isPartOf: { '@type': 'Blog', '@id': `${BLOG_URL}#blog`, name: BLOG_NAME, url: BLOG_URL },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${APP_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: BLOG_URL },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    },
  ]

  const extraMeta = `<meta property="article:published_time" content="${isoDate(post.publishedAt)}"/>
<meta property="article:modified_time" content="${isoDate(post.updatedAt || post.publishedAt)}"/>
${post.category ? `<meta property="article:section" content="${esc(post.category)}"/>` : ''}
<link rel="alternate" type="text/markdown" href="${esc(url)}.md"/>`

  const bodyHtml = blocks.map((b) => (b.heading
    ? `<h2>${esc(b.text)}</h2>`
    : `<p>${esc(b.text).replace(/\n/g, '<br/>')}</p>`)).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
${head({ title: `${post.title} | WanderWork`, description, canonical: url, image, ogType: 'article', extraMeta, schemas })}
</head>
<body>
${hero({
    heading: `<p class="big">${esc(BLOG_NAME)}</p>`,
    crumbs: `<a href="${APP_URL}/">Home</a> &gt; <a href="${BLOG_URL}">Blog</a> &gt; ${esc(post.title)}`,
  })}
<div class="wrap layout">
<main>
<article class="post"${adminAttrs(post)}>
  ${imgTag(post, { className: 'lead-img', eager: true })}
  ${post.category ? `<span class="cat">${esc(post.category)}</span>` : ''}
  <h1>${esc(post.title)}</h1>
  <div class="meta"><span>By WanderWork &middot; ${readingMinutes(post)} min read</span><time datetime="${isoDate(post.publishedAt)}">${longDate(post.publishedAt)}</time></div>
  ${post.excerpt ? `<p class="summary"><strong>${esc(post.excerpt)}</strong></p>` : ''}
  ${bodyHtml}
  <div class="box">
    <h2>Put this into practice on Wander/Work</h2>
    <ul>${PRODUCT_LINKS.map((l) => `<li><a href="${APP_URL}${l.href}">${l.label}</a></li>`).join('')}</ul>
  </div>
  ${others.length ? `<div class="box">
    <h2>Keep reading</h2>
    <ul>${others.map((p) => `<li><a href="${postUrl(p)}">${esc(p.title)}</a></li>`).join('')}</ul>
  </div>` : ''}
</article>
</main>
${sidebar(allPosts)}
</div>
${FOOTER}
</body>
</html>`
}

function blogNotFoundHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Article Not Found | WanderWork</title>
<meta name="robots" content="noindex"/>
<style>${CSS}</style>
</head>
<body>
${hero({ heading: `<p class="big">${esc(BLOG_NAME)}</p>`, crumbs: `<a href="${APP_URL}/">Home</a> &gt; <a href="${BLOG_URL}">Blog</a>` })}
<div class="wrap" style="padding:60px 20px;text-align:center">
  <h1 style="font-size:22px;margin-bottom:12px">That article could not be found</h1>
  <p><a href="${BLOG_URL}">Back to all articles</a></p>
</div>
</body>
</html>`
}

// Plain Markdown copy of an article, for AI tools that prefer it over HTML.
function blogPostMarkdown(post) {
  const body = bodyBlocks(post.body).map((b) => (b.heading ? `## ${b.text}` : b.text)).join('\n\n')
  return `# ${post.title}

Published ${longDate(post.publishedAt)} by WanderWork${post.category ? ` in ${post.category}` : ''}
Source: ${postUrl(post)}

${post.excerpt ? `> ${post.excerpt}\n\n` : ''}${body}

---

WanderWork (${APP_URL}) is a remote job board and AI job search platform.
${PRODUCT_LINKS.map((l) => `- [${l.label}](${APP_URL}${l.href})`).join('\n')}
`
}

// Markdown index of every article, in the llms.txt style.
function blogIndexMarkdown(posts) {
  return `# ${BLOG_NAME}

> ${BLOG_DESCRIPTION}

## Articles

${posts.map((p) => `- [${p.title}](${postUrl(p)}.md): ${p.excerpt}`).join('\n')}

## More

- [Blog home](${BLOG_URL})
- [RSS feed](${FEED_URL})
- [About WanderWork](${APP_URL}/llms.txt)
`
}

const cdata = (text) => `<![CDATA[${String(text ?? '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`

function blogRssXml(posts) {
  const items = posts.map((p) => {
    const html = bodyBlocks(p.body).map((b) => (b.heading ? `<h2>${esc(b.text)}</h2>` : `<p>${esc(b.text)}</p>`)).join('')
    const image = resolveBlogImage(p.image, APP_URL)
    return `  <item>
    <title>${cdata(p.title)}</title>
    <link>${esc(postUrl(p))}</link>
    <guid isPermaLink="true">${esc(postUrl(p))}</guid>
    <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
    ${p.category ? `<category>${cdata(p.category)}</category>` : ''}
    <description>${cdata(p.excerpt)}</description>
    <content:encoded>${cdata(html)}</content:encoded>
    <media:content url="${esc(image.url)}" medium="image"/>
  </item>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>${esc(BLOG_NAME)}</title>
  <link>${BLOG_URL}</link>
  <description>${esc(BLOG_DESCRIPTION)}</description>
  <language>en</language>
  <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>
  ${posts.length ? `<lastBuildDate>${new Date(Math.max(...posts.map((p) => new Date(p.updatedAt || p.publishedAt).getTime()))).toUTCString()}</lastBuildDate>` : ''}
${items}
</channel>
</rss>`
}

module.exports = { BLOG_URL, postUrl, blogIndexHtml, blogPostHtml, blogNotFoundHtml, blogPostMarkdown, blogIndexMarkdown, blogRssXml }
