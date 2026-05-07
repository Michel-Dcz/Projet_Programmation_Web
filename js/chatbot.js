//le chat box à été fais sans ia (bulles, new div...)
//les reponses du chatbox sont celle d'une ia importé avec une api key
//la gestion des réponses à été fait avec l'aide d'une ia car rien ne fonctionnait



const chatBtn = document.getElementById('chat-button');
const sidebar = document.getElementById('chat-sidebar');
const input = document.querySelector('#user-input');
const chatcontent = document.querySelector('.chat-content');

// Configuration Groq API (gratuit, CORS natif)
// ⚠️ CLÉ GROQ - à remplacer par ta clé (voir GROQ_API_KEY.txt à la racine)
const GROQ_API_KEY = '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';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';


// (Les fonctions getLocalResponse restent en fallback si Groq échoue)

// --- Site index + search (Fuse.js) ---
const SITE_INDEX = [
    {
        title: 'Accueil',
        url: 'html/acceuil.html',
        snippet: "Page d'accueil avec présentation et liens rapides vers les cours et le planning"
    },
    {
        title: 'À propos',
        url: 'html/apropos.html',
        snippet: 'Informations sur le département et les enseignants'
    },
    {
        title: 'Cours - Semestre 1',
        url: 'html/cours.html#semestre_1',
        snippet: 'Liste des cours et PDF pour le Semestre 1'
    },
    {
        title: 'Cours - Semestre 2',
        url: 'html/cours.html#semestre_2',
        snippet: 'Liste des cours et PDF pour le Semestre 2'
    },
    {
        title: 'Cours - Semestre 3',
        url: 'html/cours.html#semestre_3',
        snippet: 'Liste des cours et PDF pour le Semestre 3'
    },
    {
        title: 'Cours - Semestre 4',
        url: 'html/cours.html#semestre_4',
        snippet: 'Liste des cours et PDF pour le Semestre 4'
    },
    {
        title: 'Équipe',
        url: 'html/equipe.html',
        snippet: "Contact et informations sur l'équipe enseignante"
    },
    {
        title: 'Planning',
        url: 'html/planning.html',
        snippet: 'Calendrier des cours et des examens'
    }
];

const CURRENT_DOC_URL = new URL(document.baseURI || window.location.href);
const SITE_BASE_URL = CURRENT_DOC_URL.pathname.toLowerCase().includes('/html/')
    ? new URL('../', CURRENT_DOC_URL).href
    : new URL('./', CURRENT_DOC_URL).href;

const ALLOWED_SITE_URLS = new Set(
    SITE_INDEX.map(item => {
        const normalized = new URL(item.url, SITE_BASE_URL);
        return normalized.pathname + normalized.hash;
    })
);

let siteIndex = [];
let fuse = null;

async function loadFuseIfNeeded() {
    if (window.Fuse) return;
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.min.js';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Impossible de charger Fuse.js'));
        document.head.appendChild(s);
    });
}

async function initSiteIndex() {
    try {
        await loadFuseIfNeeded();
        siteIndex = SITE_INDEX;
        fuse = new Fuse(siteIndex, { keys: ['title', 'snippet'], threshold: 0.4 });
    } catch (e) {
        // fallback: minimal index from current page
        siteIndex = [{ title: document.title || 'Page actuelle', url: window.location.pathname, snippet: (document.querySelector('main')||document.body).innerText.slice(0,300) }];
        if (window.Fuse) fuse = new Fuse(siteIndex, { keys: ['title','snippet'], threshold: 0.4 });
    }
}

function getContextForQuery(query) {
    if (!fuse) return '';
    const results = fuse.search(query, { limit: 4 }).map(r => r.item);
    if (!results || results.length === 0) return '';
    return results.map((r, i) => `Resource ${i+1} - Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n');
}

function isAllowedSiteUrl(url) {
    try {
        const normalized = new URL(url, SITE_BASE_URL);
        return ALLOWED_SITE_URLS.has(normalized.pathname + normalized.hash);
    } catch (e) {
        return false;
    }
}

function normalizeSiteHref(url) {
    const value = String(url || '');
    if (CURRENT_DOC_URL.pathname.toLowerCase().includes('/html/') && value.startsWith('html/')) {
        return value.replace(/^html\//, '');
    }
    return value;
}

function limitToThreeSentences(text) {
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    const parts = clean.match(/[^.!?]+[.!?]?/g) || [];
    return parts.slice(0, 3).join(' ').trim();
}

function userAskedForLinks(userMessage) {
    const msg = (userMessage || '').toLowerCase();
    return /(lien|liens|url|redirig|page|où|ou trouver|ouverture|ouvrir)/.test(msg);
}

function normalizeText(text) {
    return (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(text) {
    return normalizeText(text).split(' ').filter(Boolean);
}

function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }

    return dp[a.length][b.length];
}

function fuzzyTokenMatch(token, keyword) {
    if (!token || !keyword) return false;
    if (token === keyword) return true;
    if (token.includes(keyword) || keyword.includes(token)) return true;

    const len = Math.max(token.length, keyword.length);
    const maxDist = len >= 8 ? 2 : 1;
    return levenshtein(token, keyword) <= maxDist;
}

function fuzzyContainsKeyword(tokens, rawKeyword) {
    const keyword = normalizeText(rawKeyword);
    if (!keyword) return false;

    // direct phrase check first
    const sentence = tokens.join(' ');
    if (sentence.includes(keyword)) return true;

    const parts = keyword.split(' ').filter(Boolean);
    return parts.every(part => tokens.some(t => fuzzyTokenMatch(t, part)));
}

function fuzzyContainsAny(tokens, keywords) {
    for (const k of keywords) {
        if (fuzzyContainsKeyword(tokens, k)) {
            console.log('✓ Keyword matched:', k, 'in tokens:', tokens);
            return true;
        }
    }
    return false;
}

function shouldUseSiteOnlyLocationAnswer(userMessage) {
    const tokens = tokenize(userMessage);
    const locationKeywords = ['ou trouver', 'ou sont', 'ou se trouve', 'trouver', 'localiser', 'emplacement', 'ou'];
    const resourceKeywords = ['cours', 'python', 'java', 'algo', 'algorithmique', 'planning', 'equipe', 'apropos', 'semestre', 'bdd', 'reseau', 'web', 'structures', 'donnees', 'structure', 'donnee', 'linux', 'complexite', 'prof', 'profs', 'professeur', 'professeurs', 'enseignant', 'enseignants'];
    const teamKeywords = ['prof', 'profs', 'professeur', 'professeurs', 'enseignant', 'enseignants', 'equipe pedagogique', 'equipe'];
    const aboutKeywords = ['createur', 'createurs', 'eleve', 'eleves', 'etudiant', 'etudiants', 'groupe', 'groupe projet', 'auteur', 'auteurs', 'projet'];
    const siteInfoKeywords = ['info site', 'infos site', 'information site', 'informations site', 'presentation site', 'aide site', 'a propos du site', 'accueil'];
    const siteWords = ['site', 'plateforme', 'web'];

    const asksLocation = fuzzyContainsAny(tokens, locationKeywords);
    const asksSiteResource = fuzzyContainsAny(tokens, resourceKeywords);
    const asksTeam = fuzzyContainsAny(tokens, teamKeywords);
    const asksAbout = fuzzyContainsAny(tokens, aboutKeywords);
    const asksSiteInfo = fuzzyContainsAny(tokens, siteInfoKeywords) || (fuzzyContainsAny(tokens, ['info', 'infos', 'information', 'informations', 'presentation']) && fuzzyContainsAny(tokens, siteWords));

    return (asksLocation && asksSiteResource) || asksTeam || asksAbout || asksSiteInfo;
}

function buildSiteOnlyLocationAnswer(userMessage) {
    const tokens = tokenize(userMessage);
    const teamKeywords = ['prof', 'profs', 'professeur', 'professeurs', 'enseignant', 'enseignants', 'equipe pedagogique', 'equipe'];
    const aboutKeywords = ['createur', 'createurs', 'eleve', 'eleves', 'etudiant', 'etudiants', 'groupe', 'groupe projet', 'auteur', 'auteurs', 'projet'];
    const homeKeywords = ['info site', 'infos site', 'information site', 'informations site', 'presentation site', 'aide site', 'a propos du site', 'accueil'];
    const siteWords = ['site', 'plateforme', 'web'];

    if (fuzzyContainsAny(tokens, teamKeywords)) {
        const teamEntry = SITE_INDEX.find(item => item.url.includes('equipe.html')) || { title: 'Équipe', url: 'html/equipe.html' };
        return `Sur ce site, consulte :\n[${teamEntry.title}](${teamEntry.url})`;
    }

    if (fuzzyContainsAny(tokens, homeKeywords) || (fuzzyContainsAny(tokens, ['info', 'infos', 'information', 'informations', 'presentation']) && fuzzyContainsAny(tokens, siteWords))) {
        const homeEntry = SITE_INDEX.find(item => item.url.includes('acceuil.html')) || { title: 'Accueil', url: 'html/acceuil.html' };
        return `Sur ce site, consulte :\n[${homeEntry.title}](${homeEntry.url})`;
    }

    if (fuzzyContainsAny(tokens, aboutKeywords)) {
        const aboutEntry = SITE_INDEX.find(item => item.url.includes('apropos.html')) || { title: 'À propos', url: 'html/apropos.html' };
        return `Sur ce site, consulte :\n[${aboutEntry.title}](${aboutEntry.url})`;
    }

    const courseEntries = SITE_INDEX.filter(item => item.url.includes('cours.html#semestre_'));

    // Mapping base sur les sections reelles de html/cours.html
    const subjectTargets = [
        { keywords: ['algorithmique', 'algo'], semesters: ['semestre_1'] },
        { keywords: ['programmation en python', 'python', 'prog python'], semesters: ['semestre_1'] },
        { keywords: ['structure donnees 1', 'ti202'], semesters: ['semestre_2'] },
        { keywords: ['complexite'], semesters: ['semestre_2'] },
        { keywords: ['structure donnees 2', 'ti302'], semesters: ['semestre_3'] },
        { keywords: ['linux', 'systeme linux'], semesters: ['semestre_3'] },
        { keywords: ['reseau', 'reseaux', 'network'], semesters: ['semestre_3'] },
        { keywords: ['base de donnees', 'bases de donnees', 'bdd', 'database', 'sql'], semesters: ['semestre_4'] },
        { keywords: ['java', 'poo'], semesters: ['semestre_4'] },
        { keywords: ['programmation web', 'web', 'html', 'css', 'javascript', 'js'], semesters: ['semestre_4'] },
        { keywords: ['structure donnees', 'structures donnees'], semesters: ['semestre_2', 'semestre_3'] },
        { keywords: ['cours', 'matiere', 'module', 'ressource'], semesters: ['semestre_1', 'semestre_2', 'semestre_3', 'semestre_4'] }
    ];

    let selected = [];
    const collectedSemesters = new Set();
    
    // Collect ALL matching semester rules (don't break after first match)
    for (const rule of subjectTargets) {
        if (fuzzyContainsAny(tokens, rule.keywords)) {
            console.log('🎯 Matched rule keywords:', rule.keywords, '→ semesters:', rule.semesters);
            rule.semesters.forEach(s => collectedSemesters.add(s));
        }
    }
    
    if (collectedSemesters.size > 0) {
        console.log('📍 Collected semesters:', Array.from(collectedSemesters));
        selected = courseEntries.filter(item => 
            Array.from(collectedSemesters).some(s => item.url.includes(s))
        );
        console.log('📍 Selected entries:', selected.map(e => e.title));
    }

    // Fallback robuste: rester uniquement dans la page Cours
    if (selected.length === 0) {
        selected = courseEntries.length > 0 ? courseEntries : [{ title: 'Cours', url: 'html/cours.html' }];
    }

    const first = selected[0];
    const second = selected[1];

    // For location queries, always include links (user explicitly asked "where to find")
    return second
        ? `Sur ce site, consulte :\n[${first.title}](${first.url})\n[${second.title}](${second.url})`
        : `Sur ce site, consulte :\n[${first.title}](${first.url})`;
}

chatBtn.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    chatBtn.classList.toggle('active');
});

document.addEventListener('keydown', (event) => {
    if (event.key === "Escape" && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        chatBtn.classList.remove('active');
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === "Enter" && sidebar.classList.contains('active')) {
        let div = document.createElement('div');
        div.setAttribute('class', 'userquestion');
        var question = input.value;
        let p = document.createElement('p');
        p.textContent = question;
        div.appendChild(p);
        chatcontent.appendChild(div);
        input.value = '';
        response(question);
    }
});

async function response(userMessage) {
    try {
        // Afficher un indicateur de chargement
        let loadingDiv = document.createElement('div');
        loadingDiv.setAttribute('class', 'chatresponse');
        loadingDiv.setAttribute('id', 'loading-indicator');
        let loadingP = document.createElement('p');
        loadingP.textContent = '⏳ En attente de réponse IA...';
        loadingDiv.appendChild(loadingP);
        chatcontent.appendChild(loadingDiv);
        chatcontent.scrollTop = chatcontent.scrollHeight;

        console.log('📤 Message envoyé à Groq:', userMessage);

        // Prepare context from local site index and call Groq API
        await initSiteIndex();

        if (shouldUseSiteOnlyLocationAnswer(userMessage)) {
            const loadingElement = document.getElementById('loading-indicator');
            if (loadingElement) {
                loadingElement.remove();
            }
            displayResponse(buildSiteOnlyLocationAnswer(userMessage));
            return;
        }

        const contextBlock = getContextForQuery(userMessage);

        // System prompt: enforce concise answers and no automatic footer links
        const systemPrompt = contextBlock
            ? `You are a helpful French assistant for this student website. Use the site resources below to answer accurately and naturally.\n\nRules:\n- Answer in French\n- Maximum 3 short sentences\n- Do NOT add a "useful links" section at the end of every response\n- Add markdown links [LABEL](URL) only if the user explicitly asks for links/navigation\n- If you add links, use only URLs from the provided resources\n\nResources:\n${contextBlock}`
            : `You are a helpful French assistant for this student website. Answer in French with a maximum of 3 short sentences. Do not add a links section unless the user asks for links.`;

        const payload = {
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            max_tokens: 200,
            temperature: 0
        };

        // Try request with timeout and abort controller
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        let data = null;
        try {
            const response_data = await fetch(GROQ_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeout);
            console.log('📥 Réponse HTTP Groq:', response_data.status);

            if (!response_data.ok) {
                const errorData = await response_data.json().catch(() => ({}));
                console.error('❌ Erreur Groq:', errorData);
                // fall through to fallback below
            } else {
                data = await response_data.json();
                console.log('✅ Réponse IA reçue');
            }
        } catch (err) {
            clearTimeout(timeout);
            console.error('❌ Fetch Groq failed:', err);
            // continue to fallback
        }
        const aiText = (data?.choices?.[0]?.message?.content || '').trim();

        // Supprimer l'indicateur de chargement
        const loadingElement = document.getElementById('loading-indicator');
        if (loadingElement) {
            loadingElement.remove();
        }

        const isAllowedSiteUrl = (url) => {
            try {
                const normalized = new URL(url, SITE_BASE_URL);
                return ALLOWED_SITE_URLS.has(normalized.pathname + normalized.hash);
            } catch (e) {
                return false;
            }
        };

        const sanitizeAiText = (text) => text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
            return isAllowedSiteUrl(url) ? `[${label}](${url})` : label;
        });

        const getSiteLinksFromText = (text) => {
            const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
            const links = [];
            let match;
            while ((match = linkRegex.exec(text)) !== null) {
                if (isAllowedSiteUrl(match[2])) {
                    links.push({ label: match[1].trim(), url: match[2].trim() });
                }
            }
            return links;
        };

        const sanitizedText = sanitizeAiText(aiText);
        const conciseText = limitToThreeSentences(sanitizedText);

        // Garder seulement les liens du site, et sinon proposer des liens internes utiles
        let finalLinks = getSiteLinksFromText(aiText);
        if (finalLinks.length === 0) {
            const results = fuse ? fuse.search(userMessage, { limit: 3 }).map(r => r.item) : [];
            finalLinks = (results.length > 0 ? results : SITE_INDEX.slice(0, 3)).map(r => ({ label: r.title || r.url, url: r.url }));
        }

        const linkFooter = finalLinks.length > 0
            ? `\n\nLiens utiles :\n${finalLinks.slice(0, 3).map(l => `[${l.label}](${l.url})`).join('\n')}`
            : '';

        const includeLinks = userAskedForLinks(userMessage);
        const finalAnswer = conciseText.length > 0
            ? conciseText + (includeLinks ? linkFooter : '')
            : (includeLinks
                ? `Je n'ai pas pu générer une réponse complète. Voici des liens utiles pour continuer :${linkFooter}`
                : `Je n'ai pas pu générer une réponse complète pour le moment.`);

        displayResponse(finalAnswer);
    } catch (error) {
        console.error('❌ Erreur complète:', error);

        const loadingElement = document.getElementById('loading-indicator');
        if (loadingElement) {
            loadingElement.remove();
        }

        displayResponse('❌ Erreur: ' + error.message + '\n\nVérifiez la console (F12) pour plus de détails.');
    }
}

// Récupérer une réponse locale intelligente et contextuelle
function getLocalResponse(userMessage) {
    const msg = userMessage.toLowerCase();
    
    // Extraire les mots-clés importants du message
    const keywords = extractKeywords(msg);
    
    // Chercher une catégorie de réponse correspondante
    for (const [category, data] of Object.entries(knowledgeBase)) {
        if (category === 'default') continue;
        if (data.patterns && data.patterns.some(p => msg.includes(p))) {
            const baseResponse = data.responses[Math.floor(Math.random() * data.responses.length)];
            // Enrichir la réponse avec les mots-clés trouvés
            return enrichResponse(baseResponse, keywords, msg);
        }
    }

    // Fallback: réponse par défaut enrichie
    const defaultResponses = knowledgeBase.default.responses;
    const baseResponse = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
    return enrichResponse(baseResponse, keywords, msg);
}

// Extraire les mots-clés du message pour réponses contextuelles
function extractKeywords(msg) {
    const stopWords = ['le', 'la', 'les', 'un', 'une', 'de', 'du', 'et', 'ou', 'est', 'être', 'avoir', 'aller', 'ce', 'cet', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'qu', 'qui', 'que', 'où', 'quand', 'comment', 'pourquoi', 'a', 'à', 'par', 'pour', 'dans', 'sur', 'sous', 'avec', 'sans', 'si', 'en', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'moi', 'toi', 'lui', 'eux', 'ca', 'ça', 'c\'est', 'c est', 'est-ce', 'est ce'];
    
    const words = msg.split(/[\s\?\!\.\,]+/).filter(w => w.length > 2 && !stopWords.includes(w));
    return words.slice(0, 3);
}

// Enrichir la réponse avec les mots-clés du contexte
function enrichResponse(baseResponse, keywords, originalMsg) {
    // Si on n'a pas de mots-clés pertinents, retourner la base
    if (keywords.length === 0) {
        return baseResponse;
    }
    
    // Essayer d'intégrer les mots-clés dans la réponse pour plus de pertinence
    if (keywords.length > 0) {
        const keyword = keywords[0];
        
        // Des réponses plus contextuelles basées sur le sujet
        if (['python', 'java', 'javascript', 'programmation', 'code'].some(k => originalMsg.includes(k))) {
            return `Sur le sujet de la programmation : ${baseResponse}`;
        }
        if (['algorithme', 'algo', 'complexité'].some(k => originalMsg.includes(k))) {
            return `Concernant l'algorithmique : ${baseResponse}`;
        }
        if (['base', 'données', 'sql', 'bdd'].some(k => originalMsg.includes(k))) {
            return `Au sujet des bases de données : ${baseResponse}`;
        }
        if (['réseau', 'web', 'internet', 'http'].some(k => originalMsg.includes(k))) {
            return `À propos des réseaux et du web : ${baseResponse}`;
        }
        if (['projet', 'travail', 'devoir', 'tp', 'td'].some(k => originalMsg.includes(k))) {
            return `Concernant ton projet ou travail : ${baseResponse}`;
        }
    }
    
    return baseResponse;
}

function displayResponse(responseText) {
    let div = document.createElement('div');
    div.setAttribute('class', 'chatresponse');
    let p = document.createElement('p');

    // Parse Markdown-like links [label](url) and create anchors
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match;
    while ((match = linkRegex.exec(responseText)) !== null) {
        const textBefore = responseText.slice(lastIndex, match.index);
        if (textBefore) p.appendChild(document.createTextNode(textBefore));
        const label = match[1];
        const url = match[2];
        const a = document.createElement('a');
        a.href = normalizeSiteHref(url);
        a.textContent = label;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        p.appendChild(a);
        lastIndex = match.index + match[0].length;
    }
    const rest = responseText.slice(lastIndex);
    if (rest) p.appendChild(document.createTextNode(rest));

    let tail = document.createElement('span');
    tail.setAttribute('class', 'tail');
    div.appendChild(tail);
    div.appendChild(p);
    chatcontent.appendChild(div);
    
    // Scroll vers le bas pour voir la dernière réponse
    chatcontent.scrollTop = chatcontent.scrollHeight;
}

document.addEventListener('click', (event) => {
    if (
        sidebar.classList.contains('active') &&
        !sidebar.contains(event.target) &&
        !chatBtn.contains(event.target)
    ) {
        sidebar.classList.remove('active');
        chatBtn.classList.remove('active');
    }
});