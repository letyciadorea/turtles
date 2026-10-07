/* =====================================================================
   FEIRA NUZZI — PORTAL DO PARCEIRO
   ===================================================================== */

const FALLBACK_IMG = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&q=80";

const VIEW_META = {
  pedidos: { title: "Pedidos de hoje", sub: "Marque as retiradas e acompanhe o movimento da banca." },
  produtos: { title: "Seus produtos", sub: "Cadastre, edite preços ou pause itens do cardápio." },
  perfil: { title: "Minha barraca", sub: "Essas informações aparecem para quem visita sua página na feira." }
};

let loja = { nome: "", categoria: "", descricao: "", tempo: "", horario: "", logo: "", banner: "", aberta: false };
let produtos = [];
let pedidos = [];
let currentView = "pedidos";
let orderFilter = "pendente";
let orderQuery = "";
let productFilter = "todos";
let productQuery = "";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function safeImg(url) {
  const s = String(url || "");
  if (s.startsWith("data:image/")) return s; // foto enviada via upload
  try {
    const u = new URL(s);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch (e) { }
  return FALLBACK_IMG;
}

/* ---------------------------------------------------------------------
   UPLOAD DE FOTOS — galeria de fotos / explorador de arquivos
   O <input type="file" accept="image/*"> já abre a galeria de fotos ou
   o explorador de arquivos do dispositivo. Aqui a imagem escolhida é
   redimensionada e convertida para base64, pronta pra ser salva e se
   adaptar ao layout dos cards (mesmo tratamento de "object-fit" de antes).
   --------------------------------------------------------------------- */
function lerImagemComoDataURL(file, maxSize = 900, qualidade = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    if (!file.type || !file.type.startsWith("image/")) {
      return reject(new Error("Selecione um arquivo de imagem."));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const escala = maxSize / Math.max(width, height);
          width = Math.round(width * escala);
          height = Math.round(height * escala);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", qualidade));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function configurarPreviewFoto(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) { preview.style.display = "none"; return; }
    try {
      const dataUrl = await lerImagemComoDataURL(file);
      preview.src = dataUrl;
      preview.style.display = "block";
    } catch (e) {
      alert(e.message || "Não foi possível carregar essa imagem.");
      input.value = "";
      preview.style.display = "none";
    }
  });
}
configurarPreviewFoto("pImg", "pImgPreview");
configurarPreviewFoto("eImg", "eImgPreview");
function parsePrice(str) {
  const m = String(str || "").match(/[\d.,]+/);
  if (!m) return 0;
  return parseFloat(m[0].replace(/\./g, "").replace(",", ".")) || 0;
}
function formatBRL(v) { return "R$ " + Number(v).toFixed(2).replace(".", ","); }
function isValidPrice(str) {
  return /^R\$\s?\d{1,3}(\.\d{3})*(,\d{2})?\s?(\/\s?\w+)?$/.test(String(str || "").trim());
}
function showToast(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}

const loginForm = document.getElementById("loginForm");
const loginScreen = document.getElementById("loginScreen");
const app = document.getElementById("app");

document.querySelectorAll(".toggle-eye").forEach(btn => {
  btn.addEventListener("click", () => {
    const t = document.getElementById(btn.dataset.target);
    const use = btn.querySelector("use");
    const showing = t.type === "password";
    t.type = showing ? "text" : "password";
    use.setAttribute("href", showing ? "#i-eye-off" : "#i-eye");
  });
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const senha = document.getElementById("loginPass").value;
  const errEl = document.getElementById("loginError");

  try {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, senha }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { errEl.classList.add("show"); return; }
    if (body.type !== "vendedor") {
      errEl.textContent = "Esta conta não é de vendedor.";
      errEl.classList.add("show");
      return;
    }
    errEl.classList.remove("show");
    enterApp(body.name);
  } catch (err) {
    errEl.textContent = "Falha de rede.";
    errEl.classList.add("show");
  }
});

async function checkSession() {
  try {
    const r = await fetch("/api/auth/session", { credentials: "include" });
    const s = await r.json();
    if (!s) { loginScreen.classList.remove("hidden"); return; }
    if (s.type === "vendedor") enterApp(s.name);
    else if (s.type === "adm") location.href = "/admin.html";
    else location.href = "/";
  } catch (e) {
    loginScreen.classList.remove("hidden");
  }
}

function enterApp(name) {
  loginScreen.classList.add("hidden");
  app.classList.add("open");

  const initial = (name || "P").trim().charAt(0).toUpperCase();
  document.getElementById("userChip").innerHTML = `
    <div class="avatar">${esc(initial)}</div>
    <span>${esc((name || "").split(" ")[0])}</span>
    <button type="button" id="logoutBtn">Sair</button>
  `;
  document.getElementById("logoutBtn").addEventListener("click", doLogout);
  document.getElementById("todayBadge").textContent = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long"
  });

  showView("pedidos");
  carregarTudo();
}

async function doLogout() {
  try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch (e) { }
  location.href = "/";
}

document.getElementById("navList").querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});
function showView(view) {
  currentView = view;
  document.querySelectorAll("#navList button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + view).classList.add("active");
  document.getElementById("viewTitle").textContent = VIEW_META[view].title;
  document.getElementById("viewSub").textContent = VIEW_META[view].sub;
}

/* O elemento #stallHeadline não existe no parceiro.html; sem esta proteção o JS
   quebrava (TypeError) e a fila de pedidos/produtos nunca era desenhada. */
function atualizarTitulo() {
  const el = document.getElementById("stallHeadline");
  if (el) el.textContent = (loja.nome || "Sua barraca") + " — gerencie o dia da feira.";
}

async function carregarTudo() {
  try {
    const r = await fetch("/api/vendor/data", { credentials: "include" });
    if (!r.ok) return;
    const dados = await r.json();
    loja = dados.loja || loja;
    produtos = dados.produtos || [];
    pedidos = dados.pedidos || [];
  } catch (e) { console.warn(e); }
  atualizarTitulo();
  renderAll();
}

function renderAll() {
  renderCrates();
  renderOrders();
  renderProducts();
  renderProfile();
}

function renderCrates() {
  const pendentes = pedidos.filter(p => p.pago && p.status !== "concluido" && p.status !== "cancelado").length;
  const aConfirmar = pedidos.filter(p => !p.pago && p.pagoInformado && p.status === "pendente").length;
  const retirados = pedidos.filter(p => p.status === "concluido").length;
  const revenue = pedidos
    .filter(p => p.pago && p.status !== "cancelado")
    .reduce((s, p) => s + (Number(p.valorNumerico) || 0), 0);
  const ativos = produtos.filter(p => p.disponivel).length;

  document.getElementById("crates").innerHTML = `
    <div class="crate"><div class="num accent">${pendentes}</div><div class="label">Pedidos pendentes</div></div>
    <div class="crate"><div class="num">${retirados}</div><div class="label">Já retirados</div></div>
    <div class="crate"><div class="num">${ativos}</div><div class="label">Produtos ativos</div></div>
    <div class="crate"><div class="num">${formatBRL(revenue)}</div><div class="label">Estimado no dia</div></div>
  `;
  const pb = document.getElementById("pendingBadge");
  const avisos = pendentes + aConfirmar;
  pb.textContent = avisos;
  pb.style.display = avisos > 0 ? "inline-block" : "none";
  const pb2 = document.getElementById("productsBadge");
  pb2.textContent = produtos.length;
  pb2.style.display = produtos.length > 0 ? "inline-block" : "none";
}

document.querySelectorAll("[data-filter]").forEach(btn => {
  btn.addEventListener("click", () => {
    orderFilter = btn.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === btn));
    renderOrders();
  });
});
document.getElementById("orderSearch").addEventListener("input", e => {
  orderQuery = e.target.value;
  renderOrders();
});

function renderOrders() {
  let list = pedidos.slice();
  if (orderFilter === "pendente") list = list.filter(p => p.status !== "concluido" && p.status !== "cancelado");
  if (orderFilter === "retirado") list = list.filter(p => p.status === "concluido");

  const q = orderQuery.trim().toLowerCase();
  if (q) {
    list = list.filter(p =>
      String(p.id).includes(q) ||
      (p.cliente || "").toLowerCase().includes(q) ||
      (p.itens || "").toLowerCase().includes(q)
    );
  }

  const el = document.getElementById("ordersList");
  if (!list.length) {
    el.innerHTML = `<div class="empty-box">Nenhum pedido nesta fila agora.</div>`;
    return;
  }

  const STATUS_TXT = { pendente: "Pendente", preparo: "Em preparo", pronto: "Pronto", concluido: "Retirado", cancelado: "Cancelado" };

  el.innerHTML = list.map(p => {
    const done = p.status === "concluido";
    const aConfirmar = !p.pago && p.pagoInformado;
    return `
      <div class="order-card ${done ? "done" : ""}">
        <div class="order-card-head">
          <div>
            <div class="oid">#${esc(p.id)}</div>
            <div class="obuyer">${esc(p.cliente)}</div>
          </div>
          <span class="status-pill ${done ? "is-done" : ""}">${aConfirmar ? "Pagamento a confirmar" : (done ? "Retirado" : (STATUS_TXT[p.status] || p.status || "pendente"))}</span>
        </div>
        <div class="oitem"><span>${esc(p.itens)}</span><span>${esc(p.valor)}</span></div>
        <div class="order-total"><span>Total</span><span>${esc(p.valor)}</span></div>
        ${aConfirmar ? `
        <div class="pay-alert">💸 ${esc(p.cliente)} informou que pagou ${esc(p.valor)}. Confira no app do banco se o PIX caiu e confirme.</div>
        <button class="order-action" data-id="${p.id}" data-action="pagamento">Confirmar pagamento</button>
        ` : done ? `
        <button class="order-action is-done" data-id="${p.id}" data-action="desfazer">Desfazer retirada</button>
        ` : p.status === "preparo" ? `
        <button class="order-action" data-id="${p.id}" data-action="pronto">Marcar como pronto</button>
        ` : `
        <button class="order-action" data-id="${p.id}" data-action="confirmar">Marcar como retirado</button>
        `}
      </div>`;
  }).join("");

  el.querySelectorAll(".order-action").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.id);
      const p = pedidos.find(x => x.id === id);
      if (!p) return;

      if (btn.dataset.action === "pagamento") {
        if (!confirm(`Confirmar que o PIX de ${p.valor} (${p.cliente}) JÁ CAIU na conta?`)) return;
        try {
          const r = await fetch(`/api/vendor/pedidos/${id}/confirmar-pagamento`, { method: "POST", credentials: "include" });
          const body = await r.json().catch(() => ({}));
          if (!r.ok) { alert(body.erro || "Não foi possível confirmar o pagamento."); return; }
          await carregarTudo();
        } catch (e) { alert("Falha de rede ao confirmar o pagamento."); }
        return;
      }

      const payload = { status: btn.dataset.action === "desfazer" ? "pronto" : (btn.dataset.action === "pronto" ? "pronto" : "concluido") };
      try {
        const r = await fetch(`/api/vendor/pedidos/${id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) { alert(body.erro || "Falha ao atualizar status."); return; }
        p.status = payload.status;
        renderOrders();
        renderCrates();
      } catch (e) { alert("Falha de rede ao atualizar status."); }
    });
  });
}

document.querySelectorAll("[data-pfilter]").forEach(btn => {
  btn.addEventListener("click", () => {
    productFilter = btn.dataset.pfilter;
    document.querySelectorAll("[data-pfilter]").forEach(b => b.classList.toggle("active", b === btn));
    renderProducts();
  });
});
document.getElementById("productSearch").addEventListener("input", e => {
  productQuery = e.target.value;
  renderProducts();
});

function renderProducts() {
  const el = document.getElementById("productsList");
  if (!produtos.length) {
    el.innerHTML = `<div class="empty-box">Você ainda não cadastrou produtos. Use o formulário abaixo.</div>`;
    return;
  }
  let list = produtos.slice();
  if (productFilter === "ativo") list = list.filter(p => p.disponivel);
  if (productFilter === "pausado") list = list.filter(p => !p.disponivel);

  const q = productQuery.trim().toLowerCase();
  if (q) list = list.filter(p => p.nome.toLowerCase().includes(q) || (p.descricao || "").toLowerCase().includes(q));

  if (!list.length) {
    el.innerHTML = `<div class="empty-box">Nenhum produto encontrado com esse filtro.</div>`;
    return;
  }
  el.innerHTML = list.map(p => {
    const semControle = p.estoque === null || p.estoque === undefined;
    const esgotado = !semControle && Number(p.estoque) <= 0;
    const estoqueBaixo = !semControle && !esgotado && Number(p.estoque) <= 3;
    let estoqueTag = "";
    if (esgotado) estoqueTag = '<span class="off-tag stock-tag stock-out">Esgotado</span>';
    else if (estoqueBaixo) estoqueTag = `<span class="off-tag stock-tag stock-low">Só ${p.estoque} em estoque</span>`;
    else if (!semControle) estoqueTag = `<span class="stock-count">${p.estoque} em estoque</span>`;
    else estoqueTag = '<span class="stock-count stock-unlimited">Sem controle de estoque</span>';

    return `
    <div class="prow">
      <img src="${esc(safeImg(p.imagem || FALLBACK_IMG))}" alt="${esc(p.nome)}" onerror="this.src='${FALLBACK_IMG}'">
      <div>
        <div class="pname">${esc(p.nome)}${p.disponivel ? "" : '<span class="off-tag">Pausado</span>'}</div>
        <div class="pdesc">${esc(p.descricao || "")}</div>
        <div class="pprice">${esc(p.preco)}</div>
        <div class="pstock">${estoqueTag} ${!semControle ? `<button type="button" class="stock-restock" data-restock="${p.id}">+ repor</button>` : ""}</div>
        ${p.configuravel && p.opcoes ? `<div class="cfg-tag">Configurável · ${p.opcoes.sabores.length} sabor(es) · ${p.opcoes.tamanhos.length} tamanho(s) · ${p.opcoes.adicionais.length} adicional(is)</div>` : ""}
      </div>
      <div class="prow-actions">
        <button class="icon-btn" data-toggle="${p.id}"><svg class="icon"><use href="#${p.disponivel ? "i-pause" : "i-play"}"/></svg></button>
        <button class="icon-btn" data-edit="${p.id}"><svg class="icon"><use href="#i-edit"/></svg></button>
        <button class="icon-btn danger" data-del="${p.id}"><svg class="icon"><use href="#i-close"/></svg></button>
      </div>
    </div>
  `;
  }).join("");

  el.querySelectorAll("[data-toggle]").forEach(btn => btn.addEventListener("click", async () => {
    const id = Number(btn.dataset.toggle);
    const p = produtos.find(x => x.id === id);
    if (!p) return;
    try {
      await fetch(`/api/vendor/produtos/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disponivel: !p.disponivel }),
      });
      p.disponivel = !p.disponivel;
      renderProducts(); renderCrates();
    } catch (e) { }
  }));

  el.querySelectorAll("[data-restock]").forEach(btn => btn.addEventListener("click", async () => {
    const id = Number(btn.dataset.restock);
    const p = produtos.find(x => x.id === id);
    if (!p) return;
    const entrada = prompt(`Repor quantas unidades de "${p.nome}"? (estoque atual: ${p.estoque})`, "10");
    if (entrada === null) return;
    const qtd = parseInt(entrada, 10);
    if (!Number.isFinite(qtd) || qtd <= 0) { alert("Informe um número positivo."); return; }
    const novoEstoque = p.estoque + qtd;
    try {
      await fetch(`/api/vendor/produtos/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estoque: novoEstoque }),
      });
      p.estoque = novoEstoque;
      renderProducts(); renderCrates();
    } catch (e) { alert("Falha de rede ao repor estoque."); }
  }));

  el.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => openEdit(Number(btn.dataset.edit))));
  el.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", async () => {
    const id = Number(btn.dataset.del);
    const p = produtos.find(x => x.id === id);
    if (!p || !confirm(`Remover "${p.nome}" do cardápio?`)) return;
    try {
      await fetch(`/api/vendor/produtos/${id}`, { method: "DELETE", credentials: "include" });
      produtos = produtos.filter(x => x.id !== id);
      renderProducts(); renderCrates();
    } catch (e) { }
  }));
}

/* ---------------------------------------------------------------------
   PRODUTO CONFIGURÁVEL (ex.: milk-shake) — editor de sabores, tamanhos
   e adicionais. É opcional: só aparece quando a caixa "Produto
   configurável" é marcada; produtos comuns não passam por aqui.
   --------------------------------------------------------------------- */
const CFG_GRUPOS = {
  sabores: {
    titulo: "Sabores", sub: "Ex.: Chocolate, Morango, Baunilha. O cliente escolhe um.",
    ph: "Ex: Chocolate", valor: null, add: "+ Adicionar sabor",
  },
  tamanhos: {
    titulo: "Tamanhos", sub: "Acréscimo sobre o preço base. Use 0,00 no tamanho base (ex.: 300 ml = 0,00; 500 ml = 3,00).",
    ph: "Ex: 500 ml", valor: "+ 3,00", add: "+ Adicionar tamanho",
  },
  adicionais: {
    titulo: "Adicionais (opcionais para o cliente)", sub: "Ex.: Chantilly 2,00 · Oreo 2,50. O cliente pode escolher nenhum, um ou vários.",
    ph: "Ex: Chantilly", valor: "+ 2,00", add: "+ Adicionar adicional",
  },
};

function cfgLinha(grupo, nome, valor) {
  const g = CFG_GRUPOS[grupo];
  const row = document.createElement("div");
  row.className = "cfg-row";
  row.innerHTML =
    `<input type="text" class="cfg-nome" maxlength="60" placeholder="${esc(g.ph)}" aria-label="Nome">` +
    (g.valor ? `<input type="text" class="cfg-valor" inputmode="decimal" placeholder="${esc(g.valor)}" aria-label="Valor em reais">` : "") +
    `<button type="button" class="cfg-del" aria-label="Remover">✕</button>`;
  row.querySelector(".cfg-nome").value = nome || "";
  const v = row.querySelector(".cfg-valor");
  if (v) v.value = valor || "";
  row.querySelector(".cfg-del").addEventListener("click", () => row.remove());
  return row;
}

function cfgValorTexto(n) { return Number(n || 0).toFixed(2).replace(".", ","); }

// opcoes (opcional): { sabores:[{nome}], tamanhos:[{nome,acrescimo}], adicionais:[{nome,preco}] }
function montarEditorOpcoes(box, opcoes) {
  box.innerHTML = Object.keys(CFG_GRUPOS).map(k => `
    <div class="cfg-group" data-grupo="${k}">
      <div class="cfg-title">${esc(CFG_GRUPOS[k].titulo)}</div>
      <div class="cfg-sub">${esc(CFG_GRUPOS[k].sub)}</div>
      <div class="cfg-rows"></div>
      <button type="button" class="cfg-add">${esc(CFG_GRUPOS[k].add)}</button>
    </div>`).join("");

  const rows = k => box.querySelector(`.cfg-group[data-grupo="${k}"] .cfg-rows`);
  box.querySelectorAll(".cfg-group").forEach(gr => {
    gr.querySelector(".cfg-add").addEventListener("click", () => {
      const linha = cfgLinha(gr.dataset.grupo);
      gr.querySelector(".cfg-rows").appendChild(linha);
      linha.querySelector(".cfg-nome").focus();
    });
  });

  if (opcoes) {
    (opcoes.sabores || []).forEach(x => rows("sabores").appendChild(cfgLinha("sabores", x.nome)));
    (opcoes.tamanhos || []).forEach(x => rows("tamanhos").appendChild(cfgLinha("tamanhos", x.nome, cfgValorTexto(x.acrescimo))));
    (opcoes.adicionais || []).forEach(x => rows("adicionais").appendChild(cfgLinha("adicionais", x.nome, cfgValorTexto(x.preco))));
  } else {
    rows("sabores").appendChild(cfgLinha("sabores"));
    rows("tamanhos").appendChild(cfgLinha("tamanhos"));
  }
}

// Lê e valida o editor. Lança Error com mensagem pronta para o usuário.
function lerEditorOpcoes(box) {
  const out = { sabores: [], tamanhos: [], adicionais: [] };
  box.querySelectorAll(".cfg-group").forEach(gr => {
    const k = gr.dataset.grupo;
    gr.querySelectorAll(".cfg-row").forEach(row => {
      const nome = row.querySelector(".cfg-nome").value.trim();
      const vEl = row.querySelector(".cfg-valor");
      const vTxt = vEl ? vEl.value.trim() : "";
      if (!nome && !vTxt) return;                       // linha em branco: ignora
      if (!nome) throw new Error("Preencha o nome em todas as linhas de " + CFG_GRUPOS[k].titulo.toLowerCase() + ".");
      if (k === "sabores") { out.sabores.push(nome); return; }
      let valor = 0;
      if (vTxt) {
        if (!/^(R\$\s?)?\d+([.,]\d{1,2})?$/.test(vTxt)) {
          throw new Error('Valor inválido em "' + nome + '". Use um formato como 3,00.');
        }
        valor = parseFloat(vTxt.replace(/^R\$\s?/, "").replace(",", "."));
      }
      if (k === "tamanhos") out.tamanhos.push({ nome, acrescimo: valor });
      else out.adicionais.push({ nome, preco: valor });
    });
  });
  const dup = (arr, rotulo) => {
    const vistos = new Set();
    for (const n of arr) {
      const c = n.toLowerCase();
      if (vistos.has(c)) throw new Error(rotulo + " repetido: " + n);
      vistos.add(c);
    }
  };
  dup(out.sabores, "Sabor");
  dup(out.tamanhos.map(t => t.nome), "Tamanho");
  dup(out.adicionais.map(a => a.nome), "Adicional");
  if (!out.sabores.length || !out.tamanhos.length) {
    throw new Error("Produto configurável precisa de pelo menos 1 sabor e 1 tamanho.");
  }
  return out;
}

function ligarToggleConfig(chkId, boxId) {
  const chk = document.getElementById(chkId), box = document.getElementById(boxId);
  chk.addEventListener("change", () => {
    box.hidden = !chk.checked;
    if (chk.checked && !box.children.length) montarEditorOpcoes(box);
  });
}
ligarToggleConfig("pConfig", "pConfigBox");
ligarToggleConfig("eConfig", "eConfigBox");

document.getElementById("addProductForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("pName").value.trim();
  let preco = document.getElementById("pPrice").value.trim();
  if (!nome || !preco) return;
  if (!preco.toUpperCase().startsWith("R$")) preco = "R$ " + preco;
  if (!isValidPrice(preco)) {
    document.getElementById("pPriceError").classList.add("show");
    return;
  }
  document.getElementById("pPriceError").classList.remove("show");

  const estoqueTexto = document.getElementById("pStock").value.trim();
  const estoque = estoqueTexto === "" ? null : parseInt(estoqueTexto, 10);
  if (estoqueTexto !== "" && (!Number.isFinite(estoque) || estoque < 0)) {
    alert("Estoque deve ser um número inteiro de 0 ou mais (ou fique vazio para não controlar).");
    return;
  }

  let cfgDados = null;
  if (document.getElementById("pConfig").checked) {
    try { cfgDados = lerEditorOpcoes(document.getElementById("pConfigBox")); }
    catch (err) { alert(err.message); return; }
  }

  let imagem = "";
  const fotoFile = document.getElementById("pImg").files[0];
  try {
    imagem = await lerImagemComoDataURL(fotoFile);
  } catch (err) {
    alert(err.message || "Não foi possível carregar a foto.");
    return;
  }

  const payload = {
    nome,
    preco,
    descricao: document.getElementById("pDesc").value.trim(),
    imagem,
    disponivel: true,
    estoque,
  };
  if (cfgDados) Object.assign(payload, { configuravel: true, ...cfgDados });
  try {
    const r = await fetch("/api/vendor/produtos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { alert(body.erro || "Erro ao salvar."); return; }
    if (cfgDados) await carregarTudo();      // recarrega p/ trazer os ids das opções
    else produtos.unshift({ id: body.id, ...payload });
    e.target.reset();
    const pBox = document.getElementById("pConfigBox");
    pBox.hidden = true; pBox.innerHTML = "";
    document.getElementById("pImgPreview").style.display = "none";
    renderProducts(); renderCrates();
    showToast("productToast", "Produto adicionado");
  } catch (err) { alert("Falha de rede."); }
});

function openEdit(id) {
  const p = produtos.find(x => x.id === id);
  if (!p) return;
  document.getElementById("editId").value = id;
  document.getElementById("eName").value = p.nome;
  document.getElementById("ePrice").value = p.preco;
  document.getElementById("eImg").value = "";
  document.getElementById("eImgCurrent").value = p.imagem || "";
  const eImgPreview = document.getElementById("eImgPreview");
  if (p.imagem) { eImgPreview.src = safeImg(p.imagem); eImgPreview.style.display = "block"; }
  else { eImgPreview.style.display = "none"; }
  document.getElementById("eStock").value = (p.estoque === null || p.estoque === undefined) ? "" : p.estoque;
  document.getElementById("eDesc").value = p.descricao || "";
  document.getElementById("eActive").checked = p.disponivel;
  const eBox = document.getElementById("eConfigBox");
  document.getElementById("eConfig").checked = !!p.configuravel;
  eBox.innerHTML = "";
  if (p.configuravel && p.opcoes) { montarEditorOpcoes(eBox, p.opcoes); eBox.hidden = false; }
  else { eBox.hidden = true; }
  document.getElementById("editOverlay").classList.add("open");
}
function closeEdit() { document.getElementById("editOverlay").classList.remove("open"); }
document.getElementById("editClose").addEventListener("click", closeEdit);
document.getElementById("editCancel").addEventListener("click", closeEdit);
document.getElementById("editOverlay").addEventListener("click", e => {
  if (e.target.id === "editOverlay") closeEdit();
});

document.getElementById("editProductForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = Number(document.getElementById("editId").value);
  let preco = document.getElementById("ePrice").value.trim();
  if (!preco.toUpperCase().startsWith("R$")) preco = "R$ " + preco;
  if (!isValidPrice(preco)) {
    document.getElementById("ePriceError").classList.add("show");
    return;
  }
  document.getElementById("ePriceError").classList.remove("show");

  const eEstoqueTexto = document.getElementById("eStock").value.trim();
  const eEstoque = eEstoqueTexto === "" ? null : parseInt(eEstoqueTexto, 10);
  if (eEstoqueTexto !== "" && (!Number.isFinite(eEstoque) || eEstoque < 0)) {
    alert("Estoque deve ser um número inteiro de 0 ou mais (ou fique vazio para não controlar).");
    return;
  }

  const pAtual = produtos.find(x => x.id === id);
  const eCfgOn = document.getElementById("eConfig").checked;
  let eCfgDados = null;
  if (eCfgOn) {
    try { eCfgDados = lerEditorOpcoes(document.getElementById("eConfigBox")); }
    catch (err) { alert(err.message); return; }
  }

  let imagem = document.getElementById("eImgCurrent").value || "";
  const novaFoto = document.getElementById("eImg").files[0];
  if (novaFoto) {
    try {
      imagem = await lerImagemComoDataURL(novaFoto);
    } catch (err) {
      alert(err.message || "Não foi possível carregar a foto.");
      return;
    }
  }

  const payload = {
    nome: document.getElementById("eName").value.trim(),
    preco,
    imagem,
    descricao: document.getElementById("eDesc").value.trim(),
    disponivel: document.getElementById("eActive").checked,
    estoque: eEstoque,
  };
  // só envia dados de configurável se está ligado (ou se estava e foi desligado)
  const mexeuConfig = eCfgOn || (pAtual && pAtual.configuravel);
  if (mexeuConfig) {
    payload.configuravel = eCfgOn;
    if (eCfgDados) Object.assign(payload, eCfgDados);
  }
  try {
    const r = await fetch(`/api/vendor/produtos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { alert(body.erro || "Erro ao salvar."); return; }
    if (mexeuConfig) {
      await carregarTudo();                  // recarrega p/ trazer os ids das opções
    } else {
      const p = produtos.find(x => x.id === id);
      Object.assign(p, payload);
    }
    closeEdit();
    renderProducts();
    showToast("productToast", "Alterações salvas");
  } catch (err) { alert("Falha de rede."); }
});

function renderProfile() {
  document.getElementById("prName").value = loja.nome || "";
  document.getElementById("prCategory").value = loja.categoria || "Outros";
  document.getElementById("prAbout").value = loja.descricao || "";
  document.getElementById("prHours").value = loja.horario || "";
  document.getElementById("prOpen").checked = !!loja.aberta;
}

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    nome: document.getElementById("prName").value.trim(),
    categoria: document.getElementById("prCategory").value,
    descricao: document.getElementById("prAbout").value.trim(),
    horario: document.getElementById("prHours").value.trim(),
    aberta: document.getElementById("prOpen").checked,
  };
  try {
    const r = await fetch("/api/vendor/loja", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error();
    Object.assign(loja, payload);
    atualizarTitulo();
    showToast("saveToast", "Salvo");
  } catch (err) { alert("Falha ao salvar."); }
});

checkSession();

// ---------------------------------------------------------------------
// Atualização automática: sem isso, o painel só mostrava os dados de
// quando o vendedor fez login (estoque, pedidos novos etc. não
// apareciam sozinhos). A cada 10s, se não tiver nenhum modal aberto,
// busca os dados de novo do servidor e re-renderiza a tela.
// ---------------------------------------------------------------------
function algumModalAberto() {
  return document.getElementById("editOverlay")?.classList.contains("open");
}

setInterval(() => {
  if (document.hidden) return;         // aba em segundo plano: não gasta requisição à toa
  if (algumModalAberto()) return;      // vendedor editando algo: não interrompe
  if (!app.classList.contains("open")) return; // ainda não logou
  carregarTudo();
}, 10000);