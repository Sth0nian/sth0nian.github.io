$(document).ready(function () {
  composeArticles();

  $('.search').on('input', function () {
    searchArticles($(this).val());
  });

  // Clicking a tag filters the list by that tag
  $('#blogcontent').on('click keydown', '.tag', function (e) {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const tag = $(this).data('tag');
    $('.search').val(tag);
    searchArticles(tag);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Titles are generated wrapped in <h1>; keep only the text
function cleanTitle(title) {
  return String(title).replace(/<\/?h1>/gi, '').trim();
}

// Minimal inline markdown: links, bold, italics and inline code
function renderInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\W)\*([^*]+)\*(?=\W|$)/g, '$1<em>$2</em>');
}

function formatDate(dateString) {
  const date = new Date(dateString.replace(' ', 'T'));
  if (isNaN(date)) return dateString;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function readingTime(body) {
  const words = body.join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200)) + ' min read';
}

function renderArticle(article) {
  const body = article.body.map(p => '<p>' + renderInline(p) + '</p>').join('');
  const tags = article.tags
    .map(tag => '<li class="tag" role="button" tabindex="0" data-tag="' + escapeHtml(tag) + '">' + escapeHtml(tag) + '</li>')
    .join('');

  return (
    '<article class="article fade-in">' +
      '<div class="article-meta">' +
        '<time datetime="' + escapeHtml(article.date.replace(' ', 'T')) + '">' + formatDate(article.date) + '</time>' +
        '<span class="dot"></span>' +
        '<span>' + readingTime(article.body) + '</span>' +
      '</div>' +
      '<h2 class="article-title">' + escapeHtml(cleanTitle(article.title)) + '</h2>' +
      '<div class="article-body">' + body + '</div>' +
      (tags ? '<ul class="tags">' + tags + '</ul>' : '') +
    '</article>'
  );
}

function composeArticles(curatedArticles) {
  const list = (curatedArticles || articles).slice();

  // Sort articles by date (newest first)
  list.sort((a, b) => new Date(b.date.replace(' ', 'T')) - new Date(a.date.replace(' ', 'T')));

  if (list.length === 0) {
    $('#blogcontent').html(
      '<div class="empty-state"><span class="emoji">🐔</span>Nothing here. Try another search.</div>'
    );
  } else {
    $('#blogcontent').html(list.map(renderArticle).join(''));
  }

  $('#result-count').text(list.length + (list.length === 1 ? ' post' : ' posts'));
}

function searchArticles(str) {
  const query = str.trim().toLowerCase();
  if (query === '') {
    composeArticles();
    return;
  }

  const matches = articles.filter(article =>
    cleanTitle(article.title).toLowerCase().includes(query) ||
    article.tags.some(tag => tag.toLowerCase().includes(query)) ||
    article.body.some(p => p.toLowerCase().includes(query))
  );
  composeArticles(matches);
}
