/* =====================================================================
   FEIRA NUZZI — PAINEL ADMIN
   ===================================================================== */

const TITLES = {
  dashboard: ['Painel interno', 'Administração da feira — reservas, barracas, estoque e gente.', 'Visão geral', 'Dashboard', 'Acompanhe o movimento do dia da feira'],
  pix: ['Financeiro', 'Clientes que avisaram que pagaram: confira no banco e confirme.', 'Financeiro', 'PIX', 'Pagamentos informados pelos clientes'],
  reservas: ['Gestão', 'Aprove pedidos, cancele ou marque a retirada na barraca.', 'Gestão', 'Reservas', 'Filtros por status e ações rápidas'],
  lojas: ['Cadastros', 'Barracas da feira — aprove stands e acompanhe cada grupo.', 'Cadastros', 'Lojas', 'Stands, categorias e responsáveis'],
  produtos: ['Estoque', 'O que cada barraca está oferecendo na praça.', 'Estoque', 'Produtos', 'Preço, quantidade e reservas'],
  usuarios: ['Acessos', 'Quem entra no sistema: clientes, lojas e admin.', 'Acessos', 'Usuários', 'Contas e permissões'],
  relatorios: ['Números', 'Um retrato do movimento acumulado da feira.', 'Números', 'Relatórios', 'Totais, ranking e lista do dia'],
  config: ['Sistema', 'Dados gerais usados em todo o site da feira.', 'Sistema', 'Configurações', 'Nome, taxa, data e regras']
};

const STATUS_LABEL = {
  pendente: 'Pendente', preparo: 'Em preparo', pronto: 'Pronto',
  concluido: 'Concluído', cancelado: 'Cancelado'
};

let RESERVAS = [];
let PIX = [];
let LOJAS = [];
let PRODUTOS = [];
let USUARIOS = [];
let DASH = null;
let resFilter = 'todas';

function badge(status) {
  const map = {
    Pendente: 'b-wait', 'Em preparo': 'b-ready', Pronto: 'b-ready',
    Concluído: 'b-done', Cancelado: 'b-no',
    Ativo: 'b-ok', Baixo: 'b-low', Esgotado: 'b-no',
    cliente: 'b-done', vendedor: 'b-ready', adm: 'b-ok'
  };
  return `<span class="badge ${map[status] || 'b-done'}">${status}</span>`;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.display = 'none', 2200);
}

function showView(id) {
  document.querySelectorAll('main > section').forEach(s => s.hidden = s.id !== 'view-' + id);
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === id));
  const t = TITLES[id];
  document.getElementById('kicker').textContent = t[0];
  const pl = document.getElementById('pageLead');
  if (pl) pl.textContent = t[1];
  document.getElementById('pageKicker').textContent = t[2];
  document.getElementById('pageTitle').textContent = t[3];
  document.getElementById('pageSub').textContent = t[4];
}

document.getElementById('nav').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  showView(btn.dataset.view);
});
document.querySelectorAll('[data-goto]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.goto)));

async function checkSession() {
  try {
    const r = await fetch('/api/auth/session', { credentials: 'include' });
    const s = await r.json();
    if (!s) { location.href = '/'; return; }
    if (s.type === 'vendedor') { location.href = '/parceiro.html'; return; }
    if (s.type !== 'adm') { location.href = '/'; return; }
    carregarTudo();
  } catch (e) {
    location.href = '/';
  }
}

async function doLogout() {
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) { }
  location.href = '/';
}

async function carregarTudo() {
  try {
    const [dash, lojas, produtos, usuarios, reservas, pix] = await Promise.all([
      fetch('/api/admin/dashboard', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch('/api/admin/lojas', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch('/api/admin/produtos', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch('/api/admin/usuarios', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch('/api/admin/reservas', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch('/api/admin/pix/pendentes', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
    ]);
    DASH = dash;
    LOJAS = lojas;
    PRODUTOS = produtos;
    USUARIOS = usuarios;
    RESERVAS = reservas;
    PIX = pix;
  } catch (e) { console.warn(e); }

  renderDash();
  renderReservas();
  renderPix();
  renderLojas();
  renderProdutos();
  renderUsers();
  renderRelatorios();
}

function renderDash() {
  if (DASH) {
    document.getElementById('statReservasHoje').textContent = DASH.reservas_hoje;
    document.getElementById('statPendentes').textContent = DASH.pendentes;
    document.getElementById('statLojas').textContent = DASH.lojas_ativas;
    document.getElementById('statEstoque').textContent = DASH.estoque_baixo;

    document.getElementById('dashReservas').innerHTML = (DASH.ultimas || []).map(r => `
      <tr>
        <td>#${r.id}</td>
        <td class="namecell"><b>${r.cliente}</b></td>
        <td>${r.loja}</td>
        <td>${badge(STATUS_LABEL[r.status] || r.status)}</td>
      </tr>
    `).join('') || `<tr><td colspan="4" class="empty">Sem reservas ainda.</td></tr>`;

    const rank = DASH.ranking || [];
    const max = rank.length ? Math.max(...rank.map(r => r.reservas)) : 1;
    document.getElementById('dashRank').innerHTML = rank.map((r, i) => `
      <div class="rank-row">
        <strong>#${i + 1}</strong>
        <div>
          <div>${r.loja}</div>
          <div class="bar-wrap"><div class="bar" style="width:${(r.reservas / max) * 100}%"></div></div>
        </div>
        <b>${r.reservas}</b>
      </div>
    `).join('') || `<p class="empty">Sem lojas com reservas.</p>`;
  }
}

document.getElementById('resFilters').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  resFilter = btn.dataset.filter;
  document.querySelectorAll('#resFilters button').forEach(b => b.classList.toggle('active', b === btn));
  renderReservas();
});

function renderReservas() {
  const list = RESERVAS.filter(r => resFilter === 'todas' ? true : r.status === resFilter);
  document.getElementById('resBody').innerHTML = list.map(r => `
    <tr>
      <td>#${r.id}<br><span style="color:var(--muted);font-size:11px">${dataLocal(r.criado_em)}</span></td>
      <td class="namecell"><b>${r.cliente_nome}</b></td>
      <td class="namecell"><b>${r.itens}</b><span>${r.loja_nome}</span></td>
      <td>${r.valor}</td>
      <td>${badge(r.status === 'pendente' && r.pago === 0 ? 'Pendente' : (STATUS_LABEL[r.status] || r.status))}${r.status === 'pendente' && r.pago === 0 ? '<br><span style="font-size:11px;color:var(--muted)">pagamento informado</span>' : ''}</td>
      <td>
        <div class="row-actions">
          ${r.status === 'pendente' ? (r.pago === 0
            ? `<button class="good" onclick="confirmarPix('${r.reserva_id}')">Confirmar PIX</button>`
            : `<button class="good" onclick="mudarStatus(${r.id}, 'preparo')">Aprovar</button>`) : ''}
          ${r.status === 'preparo' ? `<button class="good" onclick="mudarStatus(${r.id}, 'pronto')">Pronto</button>` : ''}
          ${r.status === 'pronto' ? `<button class="good" onclick="mudarStatus(${r.id}, 'concluido')">Retirada</button>` : ''}
          ${r.status !== 'cancelado' && r.status !== 'concluido' ? `<button class="bad" onclick="${r.status === 'pendente' && r.pago === 0 ? `cancelarPix('${r.reserva_id}')` : `mudarStatus(${r.id}, 'cancelado')`}">Cancelar</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="empty">Nenhuma reserva neste filtro.</td></tr>`;
}

async function mudarStatus(id, status) {
  try {
    const r = await fetch(`/api/vendor/pedidos/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (!r.ok) {
      toast('Falha ao atualizar reserva');
      return;
    }
    const res = RESERVAS.find(x => x.id === id);
    if (res) res.status = status;
    renderReservas();
    toast(`Reserva #${id} → ${STATUS_LABEL[status]}`);
  } catch (e) { toast('Falha ao atualizar'); }
}

function renderLojas() {
  document.getElementById('lojaCards').innerHTML = LOJAS.map(l => `
    <article class="shop">
      <div class="cover" id="cover-${l.id}" style="${l.logo ? `background-image:url('${l.logo}')` : ''}">
        <span>${l.categoria || 'Sem categoria'} · Stand #${l.id}</span>
        <label class="cover-upload-btn" for="fotoLoja-${l.id}" title="Adicionar/trocar foto da barraquinha">
          📷 ${l.logo ? 'Trocar foto' : 'Adicionar foto'}
        </label>
        <input type="file" accept="image/*" id="fotoLoja-${l.id}" class="cover-upload-input" data-loja-id="${l.id}">
      </div>
      <div class="body">
        <h4>${l.nome}</h4>
        <p>${l.dono_nome} · ${l.dono_email}</p>
        <div class="meta">
          <span>${l.total_produtos} produtos</span>
          <span>${l.total_reservas} reservas</span>
        </div>
        <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center">
          ${badge(l.aberta ? 'Ativo' : 'Esgotado')}
        </div>
      </div>
    </article>
  `).join('') || `<p class="empty">Nenhuma loja cadastrada.</p>`;

  document.querySelectorAll('.cover-upload-input').forEach(input => {
    input.addEventListener('change', () => enviarFotoLoja(input));
  });
}

/* ---------------------------------------------------------------------
   FOTO DA BARRAQUINHA — upload via galeria de fotos / explorador de
   arquivos (o próprio <input type="file" accept="image/*"> já abre
   esses dois seletores no celular/computador). A imagem é redimensionada
   e comprimida no navegador antes de ser enviada, e salva na coluna
   "logo" já existente na tabela lojas (nenhuma mudança no banco).
   --------------------------------------------------------------------- */
function lerImagemComoDataURL(file, maxSize = 900, qualidade = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Selecione um arquivo de imagem.'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const escala = maxSize / Math.max(width, height);
          width = Math.round(width * escala);
          height = Math.round(height * escala);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function enviarFotoLoja(input) {
  const lojaId = input.dataset.lojaId;
  const file = input.files && input.files[0];
  if (!file) return;

  const cover = document.getElementById(`cover-${lojaId}`);
  let dataUrl;
  try {
    dataUrl = await lerImagemComoDataURL(file);
  } catch (err) {
    toast(err.message || 'Não foi possível carregar essa imagem.');
    input.value = '';
    return;
  }

  try {
    const r = await fetch(`/api/admin/lojas/${lojaId}/foto`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ logo: dataUrl }),
    });
    if (!r.ok) throw new Error('fail');
    if (cover) cover.style.backgroundImage = `url('${dataUrl}')`;
    const loja = LOJAS.find(l => String(l.id) === String(lojaId));
    if (loja) loja.logo = dataUrl;
    toast('Foto da barraquinha atualizada');
  } catch (e) {
    toast('Falha ao salvar a foto.');
  } finally {
    input.value = '';
  }
}

function renderProdutos() {
  document.getElementById('prodBody').innerHTML = PRODUTOS.map(p => {
    const est = p.estoque;
    const status = est === null || est === undefined ? 'Ativo'
      : est === 0 ? 'Esgotado'
        : est <= 3 ? 'Baixo' : 'Ativo';
    return `
      <tr>
        <td><b>${p.nome}</b></td>
        <td>${p.loja_nome}</td>
        <td>${p.preco}</td>
        <td>${est === null || est === undefined ? '—' : est}</td>
        <td>${badge(status)}</td>
      </tr>`;
  }).join('') || `<tr><td colspan="5" class="empty">Nenhum produto cadastrado.</td></tr>`;
}

function renderUsers() {
  document.getElementById('userBody').innerHTML = USUARIOS.map(u => `
    <tr>
      <td><b>${u.nome}</b></td>
      <td>${u.email}</td>
      <td>${badge(u.tipo)}</td>
      <td>${u.criado_em || ''}</td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="empty">Nenhum usuário.</td></tr>`;
}

function renderRelatorios() {
  if (!DASH) return;
  document.getElementById('relTotal').textContent = DASH.reservas_total;
  document.getElementById('relAtivas').textContent = DASH.lojas_ativas;
  document.getElementById('relPend').textContent = DASH.pendentes;
  document.getElementById('relEstoque').textContent = DASH.estoque_baixo;

  const rank = DASH.ranking || [];
  const max = rank.length ? Math.max(...rank.map(r => r.reservas)) : 1;
  document.getElementById('topProd').innerHTML = rank.map((r, i) => `
    <div class="rank-row">
      <strong>#${i + 1}</strong>
      <div>
        <div>${r.loja}</div>
        <div class="bar-wrap"><div class="bar" style="width:${(r.reservas / max) * 100}%"></div></div>
      </div>
      <b>${r.reservas}</b>
    </div>
  `).join('') || `<p class="empty">Sem dados.</p>`;
}

document.getElementById('globalSearch').addEventListener('input', e => {
  if (e.target.value.trim()) showView('reservas');
});

/* =====================================================================
   CADASTRO DE NOVA LOJA (admin cria o acesso do responsável)
   ===================================================================== */
const novaLojaOverlay = document.getElementById('novaLojaOverlay');
const formNovaLoja = document.getElementById('formNovaLoja');
const novaLojaError = document.getElementById('novaLojaError');

function abrirNovaLoja() {
  formNovaLoja.reset();
  novaLojaError.textContent = '';
  novaLojaOverlay.classList.add('open');
  document.getElementById('lojaNome').focus();
}

function fecharNovaLoja() {
  novaLojaOverlay.classList.remove('open');
}

document.getElementById('btnNovaLoja').addEventListener('click', abrirNovaLoja);
document.getElementById('btnFecharNovaLoja').addEventListener('click', fecharNovaLoja);
document.getElementById('btnCancelarNovaLoja').addEventListener('click', fecharNovaLoja);
novaLojaOverlay.addEventListener('click', e => { if (e.target === novaLojaOverlay) fecharNovaLoja(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharNovaLoja(); });

document.getElementById('btnGerarChave').addEventListener('click', () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let chave = '';
  for (let i = 0; i < 10; i++) chave += chars[Math.floor(Math.random() * chars.length)];
  document.getElementById('lojaSenha').value = chave;
});

formNovaLoja.addEventListener('submit', async e => {
  e.preventDefault();
  novaLojaError.textContent = '';

  const nome = document.getElementById('lojaNome').value.trim();
  const email = document.getElementById('lojaEmail').value.trim().toLowerCase();
  const senha = document.getElementById('lojaSenha').value;

  if (!nome || !email || senha.length < 6) {
    novaLojaError.textContent = 'Preencha nome, e-mail e uma chave de acesso com pelo menos 6 caracteres.';
    return;
  }

  const btn = formNovaLoja.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const r = await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nome, email, senha, tipo: 'vendedor' }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      novaLojaError.textContent = body.erro || 'Não foi possível cadastrar a loja.';
      return;
    }
    fecharNovaLoja();
    await carregarTudo();
    showView('lojas');
    toast(`Loja cadastrada! Acesso: ${email}`);
  } catch (err) {
    novaLojaError.textContent = 'Falha de rede ao cadastrar a loja.';
  } finally {
    btn.disabled = false;
  }
});

/* =====================================================================
   PIX — validação manual dos pagamentos
   ===================================================================== */
function escAdm(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function dataLocal(sqlUtc) {
  if (!sqlUtc) return '';
  const d = new Date(sqlUtc.replace(' ', 'T') + 'Z');
  return isNaN(d) ? sqlUtc : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function renderPix() {
  const btn = document.querySelector('#nav button[data-view="pix"] #pixCount');
  if (btn) btn.textContent = PIX.length ? `(${PIX.length})` : '';
  document.getElementById('pixBody').innerHTML = PIX.map(p => `
    <tr>
      <td><b>${dataLocal(p.criado_em)}</b><br><span style="color:var(--muted);font-size:11px">informou o pagamento</span></td>
      <td class="namecell"><b>${escAdm(p.cliente_nome)}</b><span>${escAdm(p.cliente_email || '')}</span></td>
      <td class="namecell"><span>${escAdm(p.detalhes)}</span></td>
      <td><b>R$ ${Number(p.total).toFixed(2).replace('.', ',')}</b></td>
      <td>
        <div class="row-actions">
          <button class="good" onclick="confirmarPix('${escAdm(p.reserva_id)}')">Confirmar PIX</button>
          <button class="bad" onclick="cancelarPix('${escAdm(p.reserva_id)}')">Cancelar</button>
        </div>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="empty">Nenhum pagamento aguardando confirmação.</td></tr>`;
}

async function refreshPix(manual) {
  try {
    const r = await fetch('/api/admin/pix/pendentes', { credentials: 'include' });
    if (!r.ok) return;
    const novos = await r.json();
    if (!manual && novos.length > PIX.length) toast('💸 Cliente informou um novo pagamento');
    PIX = novos;
    renderPix();
    if (manual) toast('Lista atualizada');
  } catch (e) { }
}

function _valorPix(reservaId) {
  const p = PIX.find(x => x.reserva_id === reservaId);
  if (p) return { total: `R$ ${Number(p.total).toFixed(2).replace('.', ',')}`, nome: p.cliente_nome };
  const r = RESERVAS.find(x => x.reserva_id === reservaId);
  return { total: r ? r.valor : '', nome: r ? r.cliente_nome : '' };
}

async function confirmarPix(reservaId) {
  const v = _valorPix(reservaId);
  if (!confirm(`Confirmar que o PIX de ${v.total} (${v.nome}) JÁ CAIU na sua conta?\n\nIsso confirma o pagamento e o pedido segue para a barraca.`)) return;
  try {
    const r = await fetch(`/api/admin/pix/${encodeURIComponent(reservaId)}/confirmar`, { method: 'POST', credentials: 'include' });
    if (!r.ok) { toast('Não foi possível confirmar'); return; }
    toast(`PIX ${reservaId} confirmado`);
    await carregarTudo();
  } catch (e) { toast('Falha de rede'); }
}

async function cancelarPix(reservaId) {
  if (!confirm(`Cancelar a reserva ${reservaId} (sem pagamento)? O estoque será devolvido.`)) return;
  try {
    const r = await fetch(`/api/admin/pix/${encodeURIComponent(reservaId)}/cancelar`, { method: 'POST', credentials: 'include' });
    if (!r.ok) { toast('Não foi possível cancelar'); return; }
    toast(`Reserva ${reservaId} cancelada`);
    await carregarTudo();
  } catch (e) { toast('Falha de rede'); }
}

setInterval(() => refreshPix(false), 15000);

checkSession();