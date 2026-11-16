const $ = s => document.querySelector(s);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

const iso = d => d.getFullYear() + '-' +
  String(d.getMonth() + 1).padStart(2, '0') + '-' +
  String(d.getDate()).padStart(2, '0');

const today = () => iso(new Date());

const monday = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
};

const fmtH = m => m < 60
  ? m + ' min'
  : (m / 60).toFixed(m % 60 ? 1 : 0).replace('.', ',') + ' h';

const fmtD = s => {
  const [y, m, d] = s.split('-');
  return d + '/' + m;
};

const COLORS = [
  '#4ee0b0',
  '#ffb347',
  '#7aa7ff',
  '#ff6f7d',
  '#c792ff',
  '#ffe066'
];

const NAV = [
  ['painel', 'Painel'],
  ['metas', 'Metas'],
  ['materias', 'Matérias'],
  ['estudo', 'Estudo'],
  ['notas', 'Notas'],
  ['plano', 'Plano']
];

const LOGO = '<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="12" stroke="#4ee0b0" stroke-width="2.5"/><circle cx="16" cy="16" r="6" stroke="#ffb347" stroke-width="2.5"/><circle cx="16" cy="16" r="1.8" fill="#4ee0b0"/></svg>';

let D = null;

let T = {
  run: false,
  left: 1500,
  total: 1500,
  endAt: 0,
  id: null,
  mid: ''
};

let target = +localStorage.getItem('mira-alvo') || 7;

async function api(m, p, b) {
  const r = await fetch('/api' + p, {
    method: m,
    headers: { 'Content-Type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined
  });

  const j = await r.json().catch(() => ({}));

  if (!r.ok) {
    const e = new Error(j.erro || 'Algo deu errado');
    e.status = r.status;
    throw e;
  }

  return j;
}

let toastT;

function toast(t, bad) {
  const el = $('#toast');
  el.textContent = t;
  el.className = 'on' + (bad ? ' bad' : '');

  clearTimeout(toastT);

  toastT = setTimeout(() => el.className = '', 2800);
}

async function act(m, p, b, ok) {
  try {
    D = await api(m, p, b);

    if (ok) toast(ok);

    render();

    return true;
  } catch (e) {
    if (e.status === 401) {
      D = null;
      render();
    } else {
      toast(e.message, true);
    }

    return false;
  }
}

/* ---------- cálculos ---------- */

const mat = id => D.materias.find(x => x.id === id);

function avg(mid) {
  const n = D.notas.filter(x => x.materia_id === mid);

  if (!n.length) return null;

  const w = n.reduce((a, x) => a + x.peso, 0);

  return n.reduce(
    (a, x) => a + x.nota / x.maximo * 10 * x.peso,
    0
  ) / w;
}

function overall() {
  const v = D.materias
    .map(m => avg(m.id))
    .filter(x => x !== null);

  return v.length
    ? v.reduce((a, b) => a + b) / v.length
    : null;
}

function streak() {
  const set = new Set(D.sessoes.map(s => s.data));
  const d = new Date();

  if (!set.has(iso(d))) {
    d.setDate(d.getDate() - 1);
  }

  let n = 0;

  while (set.has(iso(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }

  return n;
}

const weekMin = mid => D.sessoes
  .filter(s =>
    s.data >= monday() &&
    (mid === undefined || s.materia_id === mid)
  )
  .reduce((a, s) => a + s.minutos, 0);

const chipOf = id => {
  const m = mat(id);

  return m
    ? `<span class="chip"><i style="background:${m.cor}"></i>${esc(m.nome)}</span>`
    : '';
};

const opts = (sel, vazio) =>
  (vazio ? `<option value="">${vazio}</option>` : '') +
  D.materias.map(m =>
    `<option value="${m.id}" ${String(sel) === String(m.id) ? 'selected' : ''}>${esc(m.nome)}</option>`
  ).join('');

const isPro = () => D.user.plano === 'pro';

/* ---------- páginas públicas ---------- */

const R = () => {
  const [n, qs] = location.hash.slice(1).split('?');

  return {
    n: n.replace(/^\//, ''),
    q: new URLSearchParams(qs || '')
  };
};

const nav = h => {
  if (location.hash === '#' + h) render();
  else location.hash = h;
};

const shell = (h1, sub, body, foot = '') =>
  `<div class="split">
    <section class="art">
      <div class="logo">${LOGO}mira</div>
      <div>
        <h2>Estude com mira.</h2>
        <p>Metas, tempo e notas conectados. Todo dia, um passo mais perto da sua nota.</p>
        <div class="floaters">
          <span><i></i>2 h de foco hoje</span>
          <span><i style="background:var(--amb);box-shadow:0 0 10px var(--amb)"></i>Média 8,4</span>
          <span><i style="background:var(--blue);box-shadow:0 0 10px var(--blue)"></i>6 dias seguidos</span>
        </div>
      </div>
      <small class="muted">© Mira</small>
    </section>
    <section class="fw up">
      <a class="back" href="#">← Voltar ao início</a>
      <h1>${h1}</h1>
      <p class="muted">${sub}</p>
      ${body}
      <div class="foot">${foot}</div>
    </section>
  </div>`;

const pwField = (nome, rotulo, ac, ph = '') =>
  `<label class="f">${rotulo}
    <input name="${nome}" type="password"
      autocomplete="${ac}"
      minlength="${ac === 'current-password' ? 1 : 8}"
      required placeholder="${ph}">
  </label>`;

const errBox = id => `<p class="err" id="${id}" hidden></p>`;

function viewLand() {
  return `<div class="land">
    <div class="topbar">
      <div class="logo">${LOGO}mira</div>
      <div class="r">
        <a class="btn gh sm" href="#entrar">Entrar</a>
        <a class="btn sm" href="#criar">Criar conta</a>
      </div>
    </div>

    <section class="hero">
      <div class="up">
        <h1>Estude com <em>mira</em>.</h1>

        <p class="lead">
          Metas, horas de estudo e notas no mesmo lugar.
          Veja o que realmente move a sua nota e pare de estudar no escuro.
        </p>

        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <a class="btn" href="#criar">Começar grátis</a>
          <a class="btn gh" href="#entrar">Já tenho conta</a>
        </div>

        <ul class="ticks" style="margin-top:26px">
          <li>Metas com prazo por matéria</li>
          <li>Cronômetro que registra seu foco</li>
          <li>A nota que falta para passar</li>
        </ul>
      </div>

      <div class="card mock up" style="animation-delay:.12s">
        <div class="mk">
          <div><b>12,5 h</b><span>esta semana</span></div>
          <div><b>8,4</b><span>média geral</span></div>
        </div>

        <div class="mb">
          ${[40, 70, 55, 90, 65, 30, 80].map((h, i) =>
            `<i style="height:${h}%;animation-delay:${i * 70}ms"></i>`
          ).join('')}
        </div>
      </div>
    </section>

    <section class="sec">
      <h2>Como funciona</h2>

      <div class="how">
        <div class="card up">
          <b>1</b>
          <h3>Crie sua conta</h3>
          <p>Leva menos de um minuto. Sem cartão de crédito.</p>
        </div>

        <div class="card up" style="animation-delay:.08s">
          <b>2</b>
          <h3>Monte seu plano</h3>
          <p>Diga seu objetivo, escolha as matérias e defina a meta de horas da semana.</p>
        </div>

        <div class="card up" style="animation-delay:.16s">
          <b>3</b>
          <h3>Estude e acompanhe</h3>
          <p>Registre o foco, lance as notas e veja o painel mostrar onde melhorar.</p>
        </div>
      </div>
    </section>

    <section class="sec">
      <h2>Planos</h2>
      <div class="plans" style="padding:0 0 60px">
        ${planCards(false)}
      </div>
    </section>
  </div>`;
}

function planCards(app) {
  const cur = app ? D.user.plano : null;

  return `
    <div class="card plan up">
      <h3>Free</h3>
      <div class="pr">R$ 0<small> /mês</small></div>
      <p class="muted">Para começar a se organizar.</p>

      <ul>
        <li>Até 3 matérias</li>
        <li>Metas, cronômetro e notas</li>
        <li>Painel semanal</li>
      </ul>

      ${app
        ? (cur === 'free'
          ? '<button class="btn gh" style="width:100%" disabled>Seu plano atual</button>'
          : '<button class="btn gh" style="width:100%" data-act="cancelar">Cancelar o Pro e voltar ao Free</button>')
        : '<a class="btn gh" style="width:100%" href="#criar">Começar grátis</a>'
      }
    </div>

    <div class="card plan pro up" style="animation-delay:.1s">
      <span class="tag">MAIS POPULAR</span>
      <h3>Pro</h3>
      <div class="pr">R$ 19<small>,90 /mês</small></div>
      <p class="muted">Para quem quer evoluir de verdade.</p>

      <ul>
        <li>Matérias ilimitadas</li>
        <li>Insights: a nota que falta para passar</li>
        <li>Tudo do Free</li>
      </ul>

      ${app
        ? (cur === 'pro'
          ? '<button class="btn amb" style="width:100%" disabled>Seu plano atual</button>'
          : '<a class="btn amb" style="width:100%" href="#checkout">Assinar o Pro</a>')
        : '<a class="btn amb" style="width:100%" href="#criar">Testar o Pro</a>'
      }
    </div>`;
}

function viewAuth(modo) {
  const su = modo === 'signup';

  return shell(
    su ? 'Crie sua conta' : 'Bem-vindo de volta',
    su ? 'Grátis, sem cartão de crédito.' : 'Entre para continuar seus estudos.',

    `<form data-form="${modo}">
      ${su
        ? '<label class="f">Seu nome<input name="nome" autocomplete="name" required maxlength="60"></label>'
        : ''
      }

      <label class="f">
        E-mail
        <input name="email" type="email" autocomplete="email" required>
      </label>

      ${pwField(
        'senha',
        'Senha',
        su ? 'new-password' : 'current-password',
        su ? 'mínimo 8 caracteres' : ''
      )}

      ${su
        ? '<label class="chk"><input type="checkbox" name="termos" required>Li e aceito os Termos de Uso e a Política de Privacidade.</label>'
        : '<a class="lnk" href="#esqueci" style="font-size:14px">Esqueci minha senha</a>'
      }

      ${errBox('aerr')}

      <button class="btn" type="submit">
        ${su ? 'Criar conta' : 'Entrar'}
      </button>
    </form>`,

    su
      ? 'Já tem conta? <a href="#entrar">Entrar</a>'
      : 'Novo por aqui? <a href="#criar">Criar conta grátis</a>'
  );
}

function viewForgot() {
  return shell(
    'Esqueceu a senha?',
    'Digite seu e-mail e enviaremos um link para criar uma nova senha.',

    `<form data-form="esqueci">
      <label class="f">
        E-mail
        <input name="email" type="email" autocomplete="email" required>
      </label>

      ${errBox('aerr')}

      <div id="fok"></div>

      <button class="btn" type="submit">Enviar link</button>
    </form>`,

    'Lembrou? <a href="#entrar">Voltar para o login</a>'
  );
}

function viewReset(r) {
  const t = r.q.get('token');

  return shell(
    'Crie uma nova senha',
    'Escolha uma senha forte com pelo menos 8 caracteres.',

    t
      ? `<form data-form="reset">
          <input type="hidden" name="token" value="${esc(t)}">
          ${pwField('senha', 'Nova senha', 'new-password')}
          ${pwField('conf', 'Repita a nova senha', 'new-password')}
          ${errBox('aerr')}
          <button class="btn" type="submit">Salvar nova senha</button>
        </form>`
      : '<div class="err" style="margin-top:20px">Link inválido. Peça um novo na tela “Esqueci minha senha”.</div>',

    '<a href="#esqueci">Pedir novo link</a>'
  );
}

function viewVerify() {
  return shell(
    'Confirmando seu e-mail',
    'Só um instante…',
    '<div id="vres" class="okb" style="margin-top:20px">Verificando o link…</div>',
    ''
  );
}

function viewDev(r) {
  const em = r.q.get('email') || (D ? D.user.email : '');

  return shell(
    'Caixa de e-mail de teste',
    'Modo desenvolvimento: como não há servidor de e-mail configurado, as mensagens enviadas pelo Mira aparecem aqui (e no terminal).',

    `<form data-form="dev" style="margin-top:16px">
      <label class="f">
        E-mail
        <input name="email" type="email" value="${esc(em)}" required>
      </label>

      <button class="btn gh" type="submit">Ver mensagens</button>
    </form>

    <div id="mails" class="list" style="margin-top:18px"></div>`,

    D
      ? '<a href="#painel">Voltar ao app</a>'
      : '<a href="#entrar">Ir para o login</a>'
  );
}

/* ---------- onboarding ---------- */

const OBJ = [
  ['vestibular', 'Vestibular / ENEM', 'Prova de entrada na faculdade'],
  ['faculdade', 'Faculdade', 'Disciplinas da graduação'],
  ['concurso', 'Concurso público', 'Edital e muita revisão'],
  ['escola', 'Escola', 'Provas e trabalhos do dia a dia'],
  ['idiomas', 'Idiomas e outros', 'Cursos e estudos livres']
];

const SUG = {
  vestibular: [
    'Matemática', 'Português', 'Redação', 'Física',
    'Química', 'Biologia', 'História', 'Geografia'
  ],
  faculdade: [
    'Cálculo', 'Programação', 'Física',
    'Inglês', 'Estatística', 'Álgebra'
  ],
  concurso: [
    'Português', 'Raciocínio Lógico',
    'Direito Constitucional', 'Informática', 'Atualidades'
  ],
  escola: [
    'Matemática', 'Português', 'Ciências',
    'História', 'Geografia', 'Inglês'
  ],
  idiomas: [
    'Gramática', 'Vocabulário',
    'Listening', 'Speaking', 'Leitura'
  ]
};

let OB = {
  step: 1,
  objetivo: '',
  mats: [],
  meta: 12
};

function viewOnboard() {
  const lim = D.limiteMaterias;
  const pct = OB.step / 3 * 100;

  let body = '';

  if (OB.step === 1) {
    body = `
      <h1>Qual é o seu objetivo?</h1>
      <p>Vamos sugerir matérias e um plano de acordo com ele.</p>

      <div class="opts">
        ${OBJ.map(([k, t, d]) => `
          <button class="opt ${OB.objetivo === k ? 'on' : ''}"
            data-act="obj" data-v="${k}">
            <b>${t}</b>
            <span>${d}</span>
          </button>
        `).join('')}
      </div>`;
  }

  if (OB.step === 2) {
    body = `
      <h1>Escolha suas matérias</h1>

      <p>
        ${lim === null
          ? 'Escolha quantas quiser.'
          : `No plano Free você pode ter até ${lim} matérias. Selecionadas: <b>${OB.mats.length}/${lim}</b>.`
        }
      </p>

      <div class="cs">
        ${[...new Set([
          ...(SUG[OB.objetivo] || SUG.escola),
          ...OB.mats
        ])].map(n => `
          <button class="${OB.mats.includes(n) ? 'on' : ''}"
            data-act="mat" data-v="${esc(n)}">
            ${esc(n)}
          </button>
        `).join('')}
      </div>

      <div class="addm">
        <input id="obcustom" placeholder="Outra matéria" maxlength="40">
        <button class="btn gh" data-act="matadd">Adicionar</button>
      </div>`;
  }

  if (OB.step === 3) {
    body = `
      <h1>Quantas horas por semana?</h1>
      <p>Defina sua meta semanal de estudo. Você pode mudar depois.</p>

      <div class="big">
        <span id="obv">${OB.meta}</span> h
      </div>

      <input type="range" id="obmeta" min="3" max="60" value="${OB.meta}">

      <p class="muted" style="text-align:center;margin:10px 0 0" id="obper">
        ${OB.mats.length
          ? `≈ ${Math.max(1, Math.round(OB.meta / OB.mats.length))} h por matéria`
          : 'Sem matérias: você poderá criá-las depois.'
        }
      </p>`;
  }

  return `
    <div class="ob">
      <div class="card obc up">
        <div class="topbar" style="margin-bottom:18px">
          <div class="logo">${LOGO}mira</div>
          <button class="lnk" data-act="obskip">Pular por enquanto</button>
        </div>

        <div class="prog2">
          <i style="width:${pct}%"></i>
        </div>

        ${body}

        <div class="obn">
          <button class="btn gh" data-act="obback"
            ${OB.step === 1 ? 'style="visibility:hidden"' : ''}>
            Voltar
          </button>

          ${OB.step < 3
            ? `<button class="btn" data-act="obnext"
                ${(OB.step === 1 && !OB.objetivo) ? 'disabled style="opacity:.4"' : ''}>
                Continuar
              </button>`
            : '<button class="btn" data-act="obfinish">Concluir e ir para o painel</button>'
          }
        </div>
      </div>
    </div>`;
}

/* ---------- app ---------- */

function viewApp(r) {
  const v = [
    ...NAV.map(n => n[0]),
    'config',
    'checkout'
  ].includes(r.n) ? r.n : 'painel';

  const body = {
    painel,
    metas,
    materias,
    estudo,
    notas,
    plano,
    config: () => viewConfig(r),
    checkout: () => viewCheckout(r)
  }[v]();

  const ban = D.user.verificado
    ? ''
    : `<div class="banner-v up">
        <span>Confirme seu e-mail <b>${esc(D.user.email)}</b> para proteger sua conta.</span>

        <span>
          <button class="btn sm gh" data-act="resend">Reenviar link</button>
          <a class="btn sm gh" href="#dev-emails?email=${encodeURIComponent(D.user.email)}">Abrir e-mail de teste</a>
        </span>
      </div>`;

  return `
    <div class="shell">
      <nav class="nav">
        <div class="logo">${LOGO}mira</div>

        ${NAV.map(([k, n], i) => `
          <a href="#${k}" class="${v === k ? 'on' : ''}">
            <i>0${i + 1}</i>${n}
          </a>
        `).join('')}

        <div id="tnav"></div>
        <div class="sp"></div>

        <div class="who">
          <div>
            <b>${esc(D.user.nome)}</b><br>
            <span class="muted">${esc(D.user.email)}</span>
          </div>

          <div>
            <span class="badge ${isPro() ? 'pro' : ''}">
              ${isPro() ? 'PRO' : 'FREE'}
            </span>
          </div>

          <a class="lnk" href="#config">Conta e configurações</a>

          <button class="btn gh sm" data-act="logout">Sair</button>
        </div>
      </nav>

      <main id="main" class="up">
        ${ban}
        ${body}
      </main>
    </div>`;
}

const head = (t, p, right = '') =>
  `<div class="head">
    <div>
      <h1>${t}</h1>
      <p>${p}</p>
    </div>
    ${right}
  </div>`;

function painel() {
  const h = new Date().getHours();
  const sau = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';

  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return d;
  });

  const per = days.map(d => {
    const k = iso(d);
    const ss = D.sessoes.filter(s => s.data === k);
    const tot = ss.reduce((a, s) => a + s.minutos, 0);

    return { d, tot, ss };
  });

  const mx = Math.max(60, ...per.map(p => p.tot));

  const chart = per.map((p, i) => `
    <div class="col">
      <span class="hv">${p.tot ? fmtH(p.tot) : ''}</span>

      <div class="stack"
        style="height:${Math.max(3, p.tot / mx * 140)}px;animation-delay:${i * 60}ms">

        ${p.ss.map(s => `
          <i style="height:${s.minutos / p.tot * 100}%;background:${mat(s.materia_id)?.cor || '#5b7a6c'}"></i>
        `).join('')}
      </div>

      <small>${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][p.d.getDay()]}</small>
    </div>
  `).join('');

  const pend = D.metas.filter(m => !m.concluida);

  const doneWk = D.metas.filter(m =>
    m.concluida && m.concluida_em >= monday()
  ).length;

  const ov = overall();

  return head(
    `${sau}, ${esc(D.user.nome.split(' ')[0])}`,
    'Veja como está a sua semana.',
    '<a class="btn" href="#estudo">Começar a estudar</a>'
  ) +

  `<div class="kpis">
    <div class="card kpi m up">
      <b>${fmtH(weekMin())}</b>
      <span>estudadas nesta semana</span>
    </div>

    <div class="card kpi a up" style="animation-delay:.05s">
      <b>${doneWk}</b>
      <span>metas concluídas na semana</span>
    </div>

    <div class="card kpi b up" style="animation-delay:.1s">
      <b>${ov === null ? '–' : ov.toFixed(1).replace('.', ',')}</b>
      <span>média geral das notas</span>
    </div>

    <div class="card kpi up" style="animation-delay:.15s">
      <b>${streak()}</b>
      <span>dias seguidos estudando</span>
    </div>
  </div>

  <div class="g2">
    <div class="card up">
      <h3>Horas por dia</h3>
      <div class="chart">${chart}</div>
    </div>

    <div class="card up">
      <h3>Meta semanal por matéria</h3>

      ${D.materias.length
        ? `<div class="prog">
            ${D.materias.map(m => {
              const mn = weekMin(m.id);
              const p = Math.min(100, mn / (m.meta_horas * 60) * 100);

              return `
                <div class="r">
                  <div class="rt">
                    <span>${esc(m.nome)}</span>
                    <span class="muted">${fmtH(mn)} / ${m.meta_horas} h</span>
                  </div>

                  <div class="bar">
                    <i style="width:${p}%;background:${m.cor}"></i>
                  </div>
                </div>`;
            }).join('')}
          </div>`
        : '<p class="empty">Crie suas matérias para acompanhar a meta de horas.<br><a href="#materias" style="color:var(--mint)">Criar matéria</a></p>'
      }
    </div>
  </div>

  <div class="card up" style="margin-top:18px">
    <h3>Próximas metas</h3>

    ${pend.length
      ? `<div class="list">${pend.slice(0, 6).map(metaItem).join('')}</div>`
      : '<p class="empty">Nenhuma meta pendente. <a href="#metas" style="color:var(--mint)">Criar uma meta</a></p>'
    }
  </div>`;
}

function metaItem(m) {
  const t = today();
  let due = '';

  if (m.prazo) {
    due = `
      <span class="due ${
        !m.concluida && m.prazo < t
          ? 'late'
          : m.prazo === t
            ? 'td'
            : ''
      }">
        ${
          m.prazo === t
            ? 'hoje'
            : (!m.concluida && m.prazo < t ? 'atrasada · ' : '') + fmtD(m.prazo)
        }
      </span>`;
  }

  return `
    <div class="it ${m.concluida ? 'dn' : ''}">
      <input type="checkbox" class="ck"
        data-act="meta" data-id="${m.id}"
        ${m.concluida ? 'checked' : ''}
        aria-label="Concluir meta">

      <span class="tt">${esc(m.titulo)}</span>

      ${chipOf(m.materia_id)}
      ${due}

      <button class="x" data-act="del"
        data-k="metas" data-id="${m.id}"
        aria-label="Excluir">×</button>
    </div>`;
}

function metas() {
  const pend = D.metas.filter(m => !m.concluida);
  const fim = D.metas.filter(m => m.concluida).slice(-8).reverse();

  return head(
    'Metas',
    'O que você precisa fazer, por matéria e com prazo.'
  ) +

  `<form class="row card up" data-form="meta" style="padding:16px">
    <label class="f">
      Nova meta
      <input name="titulo" required maxlength="120" placeholder="Ex.: Resolver a lista de funções">
    </label>

    <label class="f">
      Matéria
      <select name="materia_id">${opts('', 'Sem matéria')}</select>
    </label>

    <label class="f">
      Prazo
      <input type="date" name="prazo">
    </label>

    <button class="btn" type="submit">Adicionar</button>
  </form>

  <div class="card up">
    <h3>Pendentes (${pend.length})</h3>

    ${pend.length
      ? `<div class="list">${pend.map(metaItem).join('')}</div>`
      : '<p class="empty">Tudo em dia. Que tal criar uma nova meta?</p>'
    }
  </div>

  ${fim.length
    ? `<div class="card up" style="margin-top:18px">
        <h3>Concluídas recentemente</h3>
        <div class="list">${fim.map(metaItem).join('')}</div>
      </div>`
    : ''
  }`;
}

function materias() {
  const lim = D.limiteMaterias;
  const cheio = lim !== null && D.materias.length >= lim;

  return head(
    'Matérias',
    lim === null
      ? 'Plano Pro: matérias ilimitadas.'
      : `${D.materias.length} de ${lim} matérias no plano Free.`
  ) +

  (cheio
    ? `<div class="card up" style="margin-bottom:18px;border-color:var(--amb)">
        <b>Você chegou ao limite do plano Free.</b>
        <p class="muted" style="margin:6px 0 14px">Faça upgrade para o Pro e tenha matérias ilimitadas.</p>
        <a class="btn amb sm" href="#plano">Ver o plano Pro</a>
      </div>`

    : `<form class="card up" data-form="materia"
        style="padding:16px;margin-bottom:18px;display:grid;grid-template-columns:2fr 1fr auto auto;gap:10px;align-items:end">

        <label class="f">
          Nova matéria
          <input name="nome" required maxlength="40" placeholder="Ex.: Matemática">
        </label>

        <label class="f">
          Meta (h/semana)
          <input name="meta_horas" type="number" min="1" max="80" value="5">
        </label>

        <div class="sw">
          ${COLORS.map((c, i) => `
            <label>
              <input type="radio" name="cor" value="${c}"
                ${i === D.materias.length % 6 ? 'checked' : ''}>
              <span style="background:${c}"></span>
            </label>
          `).join('')}
        </div>

        <button class="btn" type="submit">Criar</button>
      </form>`
  ) +

  (D.materias.length
    ? `<div class="mgrid">
        ${D.materias.map((m, i) => {
          const a = avg(m.id);

          return `
            <div class="card mc up"
              style="--c:${m.cor};animation-delay:${i * 50}ms">

              <h3>
                ${esc(m.nome)}
                <button class="x" data-act="del"
                  data-k="materias" data-id="${m.id}"
                  aria-label="Excluir">×</button>
              </h3>

              <p class="muted">
                ${fmtH(weekMin(m.id))} esta semana · meta ${m.meta_horas} h
              </p>

              <div class="bar" style="margin:12px 0">
                <i style="width:${Math.min(100, weekMin(m.id) / (m.meta_horas * 60) * 100)}%;background:${m.cor}"></i>
              </div>

              <p>
                Média:
                <b style="color:${m.cor}">
                  ${a === null ? 'sem notas' : a.toFixed(1).replace('.', ',')}
                </b>
              </p>
            </div>`;
        }).join('')}
      </div>`
    : '<p class="empty up">Você ainda não tem matérias. Crie a primeira acima.</p>'
  );
}

function estudo() {
  const rec = D.sessoes.slice(0, 8);

  return head(
    'Estudo',
    'Foque, registre o tempo e veja a evolução no painel.'
  ) +

  `<div class="g2">
    <div class="card timer up ${T.run ? 'run' : ''}" id="tcard">

      <div class="cfg">
        <label class="f">
          Matéria
          <select id="tmat">${opts(T.mid, 'Sem matéria')}</select>
        </label>

        <label class="f">
          Minutos
          <input id="tmin" type="number" min="1" max="180"
            value="${Math.round(T.total / 60)}"
            ${T.run || T.left < T.total ? 'disabled' : ''}>
        </label>
      </div>

      <div id="tclock">00:00</div>

      <div class="bar">
        <i id="tbar" style="width:0;background:var(--mint);animation:none;transition:width .3s linear"></i>
      </div>

      <div class="btns">
        <button class="btn" id="tgo" data-act="tgo">Iniciar</button>
        <button class="btn gh" data-act="tfin">Finalizar e registrar</button>
        <button class="btn gh" data-act="trs">Zerar</button>
      </div>
    </div>

    <div class="card up">
      <h3>Registrar tempo manualmente</h3>

      <form data-form="sessao" style="display:grid;gap:10px">
        <label class="f">
          Matéria
          <select name="materia_id">${opts('', 'Sem matéria')}</select>
        </label>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label class="f">
            Minutos
            <input name="minutos" type="number" min="1" max="600" required value="30">
          </label>

          <label class="f">
            Dia
            <input name="data" type="date" value="${today()}">
          </label>
        </div>

        <button class="btn gh" type="submit">Registrar</button>
      </form>
    </div>
  </div>

  <div class="card up" style="margin-top:18px">
    <h3>Últimas sessões</h3>

    ${rec.length
      ? `<div class="list">
          ${rec.map(s => `
            <div class="it">
              <span class="tt">${fmtH(s.minutos)}</span>
              ${chipOf(s.materia_id)}
              <span class="due">${fmtD(s.data)}</span>

              <button class="x" data-act="del"
                data-k="sessoes" data-id="${s.id}"
                aria-label="Excluir">×</button>
            </div>
          `).join('')}
        </div>`
      : '<p class="empty">Nenhuma sessão ainda. Inicie o cronômetro acima.</p>'
    }
  </div>`;
}

function notas() {
  const spark = ns => {
    if (ns.length < 2) return '';

    const p = ns.map((n, i) =>
      `${i / (ns.length - 1) * 300},${56 - n.nota / n.maximo * 52}`
    ).join(' ');

    return `
      <svg class="spark" viewBox="0 0 300 60" preserveAspectRatio="none">
        <polyline points="${p}" fill="none"
          stroke="var(--mint)" stroke-width="2.5"
          stroke-linejoin="round" stroke-linecap="round"/>
      </svg>`;
  };

  return head(
    'Notas',
    'Registre suas avaliações e acompanhe a média de cada matéria.',
    `<div class="tgt">
      Média para passar
      <input type="number" id="alvo" min="1" max="10" step="0.5" value="${target}">
    </div>`
  ) +

  (D.materias.length
    ? `<form class="card up" data-form="nota"
        style="padding:16px;margin-bottom:18px;display:grid;grid-template-columns:1.3fr 1.6fr .7fr .7fr .7fr auto;gap:10px;align-items:end">

        <label class="f">
          Matéria
          <select name="materia_id">${opts('')}</select>
        </label>

        <label class="f">
          Avaliação
          <input name="titulo" required maxlength="80" placeholder="Ex.: Prova 1">
        </label>

        <label class="f">
          Nota
          <input name="nota" type="number" step="0.01" min="0" required>
        </label>

        <label class="f">
          Máx.
          <input name="maximo" type="number" step="0.01" value="10">
        </label>

        <label class="f">
          Peso
          <input name="peso" type="number" step="0.1" value="1">
        </label>

        <button class="btn" type="submit">Salvar</button>
      </form>`

    : '<p class="empty up">Crie uma matéria primeiro para lançar notas. <a href="#materias" style="color:var(--mint)">Criar matéria</a></p>'
  ) +

  `<div class="mgrid">
    ${D.materias.map((m, i) => {
      const ns = D.notas.filter(n => n.materia_id === m.id);
      const a = avg(m.id);

      let ins = '';

      if (ns.length && a !== null) {
        if (!isPro()) {
          ins = '<div class="ins lock">🔒 Insight do Pro: veja a nota que falta para passar. <a href="#plano" style="color:var(--amb)">Conhecer o Pro</a></div>';
        } else if (a >= target) {
          ins = `<div class="ins">Você já está acima da média de ${String(target).replace('.', ',')}. Mantenha o ritmo.</div>`;
        } else {
          const W = ns.reduce((x, n) => x + n.peso, 0);

          const Sm = ns.reduce(
            (x, n) => x + n.nota / n.maximo * 10 * n.peso,
            0
          );

          const need = target * (W + 1) - Sm;

          ins = need > 10
            ? `<div class="ins bad">Só a próxima avaliação (peso 1) não basta: precisaria de ${need.toFixed(1).replace('.', ',')}. Distribua o esforço nas próximas provas.</div>`
            : `<div class="ins">Para fechar com ${String(target).replace('.', ',')}, você precisa tirar <b>${Math.max(0, need).toFixed(1).replace('.', ',')}</b> na próxima avaliação (peso 1).</div>`;
        }
      }

      return `
        <div class="card nc mc up"
          style="--c:${m.cor};animation-delay:${i * 50}ms">

          <h3>
            ${esc(m.nome)}
            <b style="color:${m.cor}">
              ${a === null ? '–' : a.toFixed(1).replace('.', ',')}
            </b>
          </h3>

          ${spark(ns)}

          ${ns.length
            ? `<div class="list">
                ${ns.slice().reverse().slice(0, 5).map(n => `
                  <div class="it">
                    <span class="tt">${esc(n.titulo)}</span>
                    <span>${n.nota}/${n.maximo}</span>
                    <span class="due">p${n.peso}</span>

                    <button class="x" data-act="del"
                      data-k="notas" data-id="${n.id}"
                      aria-label="Excluir">×</button>
                  </div>
                `).join('')}
              </div>`
            : '<p class="empty">Sem notas ainda.</p>'
          }

          ${ins}
        </div>`;
    }).join('')}
  </div>`;
}

function plano() {
  return head(
    'Plano',
    `Você está no plano <b>${isPro() ? 'Pro' : 'Free'}</b>.`
  ) +

  `<div class="plans" style="padding:0">
    ${planCards(true)}
  </div>

  <p class="muted up" style="margin-top:6px">
    O pagamento desta versão é uma simulação: nenhum valor é cobrado de verdade.
    Para cobrar, é preciso integrar um gateway (Stripe, Mercado Pago).
  </p>`;
}

const brl = c =>
  'R$ ' + (c / 100).toFixed(2).replace('.', ',');

const fdate = s => {
  const d = new Date(s.replace(' ', 'T') + 'Z');

  return isNaN(d)
    ? s
    : d.toLocaleDateString('pt-BR');
};

/* ---------- checkout (3 passos) ---------- */

function viewCheckout(r) {
  const p = r.q.get('p') || '1';

  const steps = ['Plano', 'Pagamento', 'Confirmação'];

  const stp = `
    <div class="stepper">
      ${steps.map((t, i) => `
        <div class="st ${+p === i + 1 ? 'on' : ''} ${+p > i + 1 ? 'dn' : ''}">
          <b>${+p > i + 1 ? '✓' : i + 1}</b>
          ${t}
        </div>
      `).join('<hr>')}
    </div>`;

  let body = '';

  if (p === '3') {
    const f = D.faturas[0];

    body = `
      <div class="card up" style="text-align:center;padding:44px">
        <div class="big" style="color:var(--amb)">Pro ativado!</div>

        <p class="muted" style="margin:10px 0 22px">
          ${f
            ? `Pagamento de ${brl(f.valor_centavos)} confirmado no cartão final ${esc(f.ultimos4)}.`
            : ''
          }
          <br>
          Agora você tem matérias ilimitadas e os insights de nota.
        </p>

        <a class="btn" href="#painel">Ir para o painel</a>
      </div>`;
  }

  else if (isPro()) {
    body = `
      <div class="card up">
        <b>Você já é Pro.</b>

        <p class="muted" style="margin:6px 0 14px">
          Gerencie sua assinatura em Conta e configurações.
        </p>

        <a class="btn sm" href="#config?t=assinatura">Ver assinatura</a>
      </div>`;
  }

  else if (p === '1') {
    body = `
      <div class="card up" style="max-width:560px">
        <h3>Mira Pro</h3>

        <div class="pr" style="font:800 44px var(--disp);margin:6px 0">
          R$ 19<small style="font:400 15px var(--body);color:var(--m)">,90 /mês</small>
        </div>

        <ul class="plan" style="list-style:none;padding:0;display:grid;gap:9px;margin:14px 0 20px">
          <li>Matérias ilimitadas</li>
          <li>Insights: a nota que falta para passar</li>
          <li>Cancele quando quiser</li>
        </ul>

        <a class="btn amb" href="#checkout?p=2">Continuar para o pagamento</a>
      </div>`;
  }

  else {
    body = `
      <div class="ckg up">
        <div>
          <div class="cc">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div class="chip2"></div>
              <b id="cbr" style="letter-spacing:.1em">CARTÃO</b>
            </div>

            <div class="n" id="cnum">•••• •••• •••• ••••</div>

            <div class="rw">
              <span id="cnome">Seu nome</span>
              <span id="cval">MM/AA</span>
            </div>
          </div>

          <p class="muted" style="margin-top:16px;font-size:13px;line-height:1.6">
            Pagamento simulado. Use o cartão de teste
            <b>4242 4242 4242 4242</b>, qualquer validade futura e CVC.
            O cartão <b>4000 0000 0000 0002</b> simula uma recusa.
            O Mira nunca guarda o número completo nem o CVC.
          </p>
        </div>

        <form class="card" data-form="pagar" style="display:grid;gap:14px">
          <h3>Pagamento</h3>

          <label class="f">
            Nome no cartão
            <input name="nome" autocomplete="cc-name" required maxlength="60">
          </label>

          <label class="f">
            Número do cartão
            <input name="numero" inputmode="numeric" autocomplete="cc-number"
              required placeholder="0000 0000 0000 0000" maxlength="23">
          </label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label class="f">
              Validade
              <input name="validade" inputmode="numeric"
                autocomplete="cc-exp" required placeholder="MM/AA" maxlength="5">
            </label>

            <label class="f">
              CVC
              <input name="cvc" inputmode="numeric"
                autocomplete="cc-csc" required maxlength="4" placeholder="123">
            </label>
          </div>

          ${errBox('cerr')}

          <button class="btn amb" type="submit">Pagar R$ 19,90</button>

          <a class="lnk" href="#checkout?p=1"
            style="text-align:center;font-size:14px">← Voltar</a>
        </form>
      </div>`;
  }

  return head('Assinar o Pro', 'Três passos rápidos.') + stp + body;
}

/* ---------- conta e configurações ---------- */

function viewConfig(r) {
  const t = r.q.get('t') || 'perfil';

  const tabs = [
    ['perfil', 'Perfil'],
    ['seguranca', 'Segurança'],
    ['assinatura', 'Assinatura'],
    ['dados', 'Dados e privacidade']
  ];

  let b = '';

  if (t === 'perfil') {
    b = `
      <div class="sec2">
        <form class="card" data-form="perfil">
          <label class="f">
            Nome
            <input name="nome" value="${esc(D.user.nome)}" required maxlength="60">
          </label>

          <label class="f">
            E-mail
            <input value="${esc(D.user.email)}" disabled>
          </label>

          <p>
            ${D.user.verificado
              ? '<span class="badge pro" style="background:var(--mint)">E-mail confirmado</span>'
              : '<span class="badge" style="background:rgba(255,179,71,.2);color:var(--amb)">E-mail não confirmado</span> <button type="button" class="lnk" data-act="resend">Reenviar link</button>'
            }
          </p>

          ${errBox('cerr')}

          <button class="btn" type="submit" style="justify-self:start">
            Salvar alterações
          </button>
        </form>
      </div>`;
  }

  if (t === 'seguranca') {
    b = `
      <div class="sec2">
        <form class="card" data-form="senha">
          <h3>Alterar senha</h3>

          ${pwField('atual', 'Senha atual', 'current-password')}
          ${pwField('nova', 'Nova senha', 'new-password', 'mínimo 8 caracteres')}
          ${pwField('conf', 'Repita a nova senha', 'new-password')}

          ${errBox('cerr')}

          <button class="btn" type="submit" style="justify-self:start">
            Alterar senha
          </button>
        </form>

        <div class="card">
          <h3>Sessões</h3>

          <p class="muted" style="margin-bottom:14px">
            Encerre o acesso em todos os aparelhos, inclusive neste.
          </p>

          <button class="btn gh sm" data-act="logoutall">
            Sair de todos os dispositivos
          </button>
        </div>
      </div>`;
  }

  if (t === 'assinatura') {
    b = `
      <div class="sec2">
        <div class="card">
          <h3>Seu plano</h3>

          <p>
            Plano atual:
            <b>${isPro() ? 'Pro · R$ 19,90/mês' : 'Free'}</b>
          </p>

          <div style="margin-top:14px">
            ${isPro()
              ? '<button class="btn gh sm" data-act="cancelar">Cancelar assinatura</button>'
              : '<a class="btn amb sm" href="#checkout">Assinar o Pro</a>'
            }
          </div>
        </div>

        <div class="card">
          <h3>Faturas</h3>

          ${D.faturas.length
            ? `<table class="tbl">
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Cartão</th>
                  <th>Valor</th>
                </tr>

                ${D.faturas.map(f => `
                  <tr>
                    <td>${fdate(f.criado_em)}</td>
                    <td>${esc(f.descricao)}</td>
                    <td>•••• ${esc(f.ultimos4 || '')}</td>
                    <td>${brl(f.valor_centavos)}</td>
                  </tr>
                `).join('')}
              </table>`
            : '<p class="empty">Nenhuma fatura ainda.</p>'
          }
        </div>
      </div>`;
  }

  if (t === 'dados') {
    b = `
      <div class="sec2">
        <div class="card">
          <h3>Exportar meus dados</h3>

          <p class="muted" style="margin-bottom:14px">
            Baixe tudo o que o Mira guarda sobre você em um arquivo JSON.
          </p>

          <a class="btn gh sm" href="/api/exportar" download>
            Baixar meus dados
          </a>
        </div>

        <form class="card danger" data-form="excluir">
          <h3>Excluir conta</h3>

          <p class="muted">
            Isso apaga a conta e todos os seus dados de forma permanente.
            Não dá para desfazer.
          </p>

          ${pwField('senha', 'Sua senha', 'current-password')}

          <label class="f">
            Digite EXCLUIR para confirmar
            <input name="conf" autocomplete="off" required>
          </label>

          ${errBox('cerr')}

          <button class="btn dg" type="submit" style="justify-self:start">
            Excluir minha conta
          </button>
        </form>
      </div>`;
  }

  return head(
    'Conta e configurações',
    'Gerencie seu perfil, segurança e assinatura.'
  ) +

  `<div class="ctabs">
    ${tabs.map(([k, n]) => `
      <a href="#config?t=${k}" class="${t === k ? 'on' : ''}">
        ${n}
      </a>
    `).join('')}
  </div>` + b;
}

/* ---------- cronômetro ---------- */

function drawT() {
  const m = String(Math.floor(T.left / 60)).padStart(2, '0');
  const s = String(T.left % 60).padStart(2, '0');

  const c = $('#tclock');

  if (c) {
    c.textContent = m + ':' + s;

    $('#tbar').style.width =
      (1 - T.left / T.total) * 100 + '%';

    $('#tgo').textContent = T.run
      ? 'Pausar'
      : (T.left < T.total ? 'Continuar' : 'Iniciar');

    $('#tcard').classList.toggle('run', T.run);
  }

  const n = $('#tnav');

  if (n) {
    n.style.display = T.run ? 'block' : 'none';
    n.textContent = '● ' + m + ':' + s;
  }

  document.title = T.run
    ? m + ':' + s + ' · Mira'
    : 'Mira · estude com mira';
}

function tick() {
  T.left = Math.max(0, Math.ceil((T.endAt - Date.now()) / 1000));

  drawT();

  if (T.left <= 0) finish();
}

async function finish() {
  clearInterval(T.id);

  T.run = false;

  const min = Math.round((T.total - T.left) / 60);

  if (min < 1) {
    toast('Estude pelo menos 1 minuto para registrar.', true);
    drawT();
    return;
  }

  const ok = await act(
    'POST',
    '/sessoes',
    {
      materia_id: T.mid,
      minutos: min,
      data: today()
    },
    `+${min} min de estudo registrados`
  );

  T.left = T.total;

  if (ok) drawT();
}

function readCfg() {
  const s = $('#tmat');

  if (s) T.mid = s.value;

  const m = $('#tmin');

  if (m && !T.run && T.left === T.total) {
    T.total = T.left =
      Math.min(180, Math.max(1, +m.value || 25)) * 60;
  }
}

/* ---------- render e eventos ---------- */

let vtok = null;

function render() {
  const r = R();

  let html;

  if (r.n === 'verificar') {
    html = viewVerify();
  }

  else if (r.n === 'dev-emails') {
    html = viewDev(r);
  }

  else if (r.n === 'redefinir') {
    html = viewReset(r);
  }

  else if (!D) {
    html = ({
      entrar: () => viewAuth('login'),
      criar: () => viewAuth('signup'),
      esqueci: viewForgot
    })[r.n]?.() ?? viewLand();
  }

  else if (!D.user.onboarding) {
    html = viewOnboard();
  }

  else {
    html = viewApp(r);
  }

  $('#app').innerHTML = html;

  window.scrollTo(0, 0);

  if (D) drawT();

  after(r);
}

async function after(r) {
  if (r.n === 'verificar') {
    const t = r.q.get('token');
    const res = $('#vres');

    if (!res) return;

    if (!t) {
      res.className = 'err';
      res.textContent = 'Link inválido. Abra o link que enviamos por e-mail.';
      return;
    }

    if (vtok === t) return;

    vtok = t;

    try {
      await api('POST', '/email/verificar', { token: t });

      res.innerHTML =
        'E-mail confirmado! ✓ <br><a class="btn sm" style="margin-top:12px" href="#' +
        (D ? 'painel' : 'entrar') +
        '">' +
        (D ? 'Ir para o painel' : 'Entrar na minha conta') +
        '</a>';

      if (D) D = await api('GET', '/me');

    } catch (e) {
      res.className = 'err';
      res.textContent = e.message;
    }
  }

  if (r.n === 'dev-emails') {
    loadMails(r.q.get('email') || (D ? D.user.email : ''));
  }
}

async function loadMails(email) {
  const box = $('#mails');

  if (!box || !email) return;

  try {
    const { emails } = await api(
      'GET',
      '/dev/emails?email=' + encodeURIComponent(email)
    );

    box.innerHTML = emails.length
      ? emails.map(m => `
          <div class="card mail">
            <b>${esc(m.assunto)}</b>
            <small>${esc(m.corpo)}</small>
            <a class="btn sm" style="justify-self:start" href="${esc(m.link)}">
              Abrir link
            </a>
          </div>
        `).join('')
      : '<p class="empty">Nenhuma mensagem para esse e-mail ainda.</p>';

  } catch (e) {
    box.innerHTML = '<p class="err">' + esc(e.message) + '</p>';
  }
}

addEventListener('hashchange', render);

const fail = (id, msg) => {
  const e = $('#' + id);

  if (e) {
    e.textContent = msg;
    e.hidden = false;
  } else {
    toast(msg, true);
  }
};

/* ---------- eventos de clique ---------- */

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]');

  if (!b) return;

  const a = b.dataset.act;

  if (a === 'logout') {
    clearInterval(T.id);

    T = {
      run: false,
      left: 1500,
      total: 1500,
      endAt: 0,
      id: null,
      mid: ''
    };

    await api('POST', '/logout').catch(() => {});

    D = null;

    nav('');
  }

  else if (a === 'logoutall') {
    if (!confirm('Sair de todos os dispositivos?')) return;

    await api('POST', '/logout-todos').catch(() => {});

    D = null;

    nav('entrar');

    toast('Você saiu de todos os dispositivos.');
  }

  else if (a === 'cancelar') {
    if (confirm('Cancelar o Pro? Você volta ao plano Free (até 3 matérias para novas criações).')) {
      act(
        'POST',
        '/plano',
        { plano: 'free' },
        'Assinatura cancelada'
      );
    }
  }

  else if (a === 'resend') {
    try {
      await api('POST', '/email/reenviar');

      toast('Enviamos um novo link. No modo teste, abra a caixa de e-mail de teste.');

    } catch (x) {
      toast(x.message, true);
    }
  }

  else if (a === 'del') {
    if (
      b.dataset.k === 'materias' &&
      !confirm('Excluir esta matéria e as notas dela?')
    ) return;

    act(
      'DELETE',
      `/${b.dataset.k}/${b.dataset.id}`
    );
  }

  else if (a === 'tgo') {
    readCfg();

    if (T.run) {
      clearInterval(T.id);

      T.run = false;

      T.left = Math.max(
        0,
        Math.ceil((T.endAt - Date.now()) / 1000)
      );

    } else {
      T.endAt = Date.now() + T.left * 1000;

      T.run = true;

      T.id = setInterval(tick, 250);
    }

    render();
  }

  else if (a === 'tfin') {
    readCfg();
    finish();
  }

  else if (a === 'trs') {
    clearInterval(T.id);

    T.run = false;
    T.left = T.total;

    render();
  }

  /* onboarding */

  else if (a === 'obj') {
    OB.objetivo = b.dataset.v;
    OB.mats = [];

    render();
  }

  else if (a === 'mat') {
    const n = b.dataset.v;
    const i = OB.mats.indexOf(n);
    const lim = D.limiteMaterias;

    if (i >= 0) {
      OB.mats.splice(i, 1);
    }

    else if (lim !== null && OB.mats.length >= lim) {
      return toast(`O plano Free permite até ${lim} matérias.`, true);
    }

    else {
      OB.mats.push(n);
    }

    render();
  }

  else if (a === 'matadd') {
    const v = $('#obcustom').value.trim();
    const lim = D.limiteMaterias;

    if (!v) return;

    if (lim !== null && OB.mats.length >= lim) {
      return toast(`O plano Free permite até ${lim} matérias.`, true);
    }

    if (!OB.mats.includes(v)) OB.mats.push(v);

    render();
  }

  else if (a === 'obnext') {
    OB.step++;
    render();
  }

  else if (a === 'obback') {
    OB.step--;
    render();
  }

  else if (a === 'obskip' || a === 'obfinish') {
    const skip = a === 'obskip';

    if (await act(
      'POST',
      '/onboarding',
      {
        objetivo: skip ? '' : OB.objetivo,
        materias: skip ? [] : OB.mats,
        meta_total: OB.meta
      },
      skip ? '' : 'Tudo pronto! Bom estudo.'
    )) {
      OB = {
        step: 1,
        objetivo: '',
        mats: [],
        meta: 12
      };

      nav('painel');
    }
  }
});

/* ---------- eventos de alteração ---------- */

document.addEventListener('change', e => {
  const t = e.target;

  if (t.dataset.act === 'meta') {
    act(
      'PUT',
      '/metas/' + t.dataset.id,
      {
        concluida: t.checked,
        data: today()
      },
      t.checked ? 'Meta concluída!' : ''
    );
  }

  else if (t.id === 'alvo') {
    target = Math.min(10, Math.max(1, +t.value || 7));

    localStorage.setItem('mira-alvo', target);

    render();
  }

  else if (t.id === 'tmat') {
    T.mid = t.value;
  }

  else if (t.id === 'tmin') {
    readCfg();
    drawT();
  }
});

/* ---------- eventos de input ---------- */

document.addEventListener('input', e => {
  const t = e.target;

  if (t.id === 'obmeta') {
    OB.meta = +t.value;

    $('#obv').textContent = OB.meta;

    $('#obper').textContent = OB.mats.length
      ? `≈ ${Math.max(1, Math.round(OB.meta / OB.mats.length))} h por matéria`
      : 'Sem matérias: você poderá criá-las depois.';
  }

  if (t.closest('[data-form=pagar]')) {

    if (t.name === 'numero') {
      t.value = t.value
        .replace(/\D/g, '')
        .slice(0, 19)
        .replace(/(.{4})/g, '$1 ')
        .trim();

      const d = t.value.replace(/\s/g, '');

      $('#cnum').textContent =
        (t.value || '•••• •••• •••• ••••');

      $('#cbr').textContent =
        d[0] === '4'
          ? 'VISA'
          : /^5[1-5]/.test(d)
            ? 'MASTERCARD'
            : 'CARTÃO';
    }

    if (t.name === 'validade') {
      let v = t.value.replace(/\D/g, '').slice(0, 4);

      if (v.length > 2) {
        v = v.slice(0, 2) + '/' + v.slice(2);
      }

      t.value = v;

      $('#cval').textContent = v || 'MM/AA';
    }

    if (t.name === 'nome') {
      $('#cnome').textContent = t.value || 'Seu nome';
    }

    if (t.name === 'cvc') {
      t.value = t.value.replace(/\D/g, '');
    }
  }
});

/* ---------- envio de formulários ---------- */

document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-form]');

  if (!f) return;

  e.preventDefault();

  const o = Object.fromEntries(new FormData(f));
  const k = f.dataset.form;

  const eid =
    k === 'login' ||
    k === 'signup' ||
    k === 'esqueci' ||
    k === 'reset'
      ? 'aerr'
      : 'cerr';

  {
    const er = $('#' + eid);

    if (er) er.hidden = true;
  }

  try {

    if (k === 'login') {
      D = await api('POST', '/login', o);

      toast('Bem-vindo de volta!');

      nav(D.user.onboarding ? 'painel' : 'onboarding');
    }

    else if (k === 'signup') {
      D = await api('POST', '/signup', o);

      OB = {
        step: 1,
        objetivo: '',
        mats: [],
        meta: 12
      };

      toast('Conta criada! Enviamos um e-mail de confirmação.');

      nav('onboarding');
    }

    else if (k === 'esqueci') {
      await api('POST', '/senha/esqueci', o);

      $('#fok').innerHTML = `
        <div class="okb">
          Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.
          Ele vale por 1 hora.<br>

          <a class="lnk" href="#dev-emails?email=${encodeURIComponent(o.email)}">
            Abrir a caixa de e-mail de teste (modo dev)
          </a>
        </div>`;
    }

    else if (k === 'reset') {
      if (o.senha !== o.conf) {
        return fail('aerr', 'As senhas não conferem.');
      }

      await api('POST', '/senha/redefinir', {
        token: o.token,
        senha: o.senha
      });

      D = null;

      toast('Senha alterada! Entre com a nova senha.');

      nav('entrar');
    }

    else if (k === 'dev') {
      nav('dev-emails?email=' + encodeURIComponent(o.email));
    }

    else if (k === 'perfil') {
      D = await api('POST', '/perfil', o);

      toast('Perfil atualizado');

      render();
    }

    else if (k === 'senha') {
      if (o.nova !== o.conf) {
        return fail('cerr', 'As senhas não conferem.');
      }

      D = await api('POST', '/senha/alterar', {
        atual: o.atual,
        nova: o.nova
      });

      toast('Senha alterada. Outros aparelhos foram desconectados.');

      f.reset();
    }

    else if (k === 'excluir') {
      if (o.conf !== 'EXCLUIR') {
        return fail('cerr', 'Digite EXCLUIR em maiúsculas para confirmar.');
      }

      if (!confirm('Última chance: excluir a conta para sempre?')) {
        return;
      }

      await api('POST', '/conta/excluir', {
        senha: o.senha
      });

      D = null;

      nav('');

      toast('Conta excluída.');
    }

    else if (k === 'pagar') {
      D = await api('POST', '/checkout', o);

      nav('checkout?p=3');
    }

    else {
      const rota = {
        meta: ['/metas', 'Meta adicionada'],
        materia: ['/materias', 'Matéria criada'],
        sessao: ['/sessoes', 'Tempo registrado'],
        nota: ['/notas', 'Nota salva']
      }[k];

      if (await act('POST', rota[0], o, rota[1])) {
        f.reset?.();
      }
    }

  } catch (x) {
    if (x.status === 401 && D && k !== 'senha' && k !== 'excluir') {
      D = null;
      nav('entrar');
    } else {
      fail(eid, x.message);
    }
  }
});

/* ---------- inicialização ---------- */

(async () => {
  try {
    D = await api('GET', '/me');
  } catch (e) {
    D = null;
  }

  if (D && !location.hash) {
    location.hash = 'painel';
  }

  render();
})();
