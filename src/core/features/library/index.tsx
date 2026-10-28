"use client";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Library as LibraryIcon,
  LayoutDashboard,
  ArrowUpRight,
  ArrowRight,
  Search,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Plus,
  ArrowLeftRight,
  Users,
  LogOut,
  Menu,
  X,
  Bookmark,
  Clock,
  CheckCheck,
  AlertTriangle,
  Shield,
  UserRound,
  Leaf,
  Heart,
  Sun,
  Moon,
  Pencil,
  Trash2,
  LoaderCircle,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { PageTitle, Stat, Empty, LoanTable } from "./components/library-shared";
import { ptBR } from "date-fns/locale";
import type { Book, User, View, Role, Loan } from "@/core/@types";
import { Modal } from "@/core/components/modal";
import { useLibrary } from "./hooks/use-library";
import { libraryService as service } from "./services/library-service";
import { roles } from "./data/demo";
import { BookForm } from "./components/book-form";
import { UserForm } from "./components/user-form";
import { Brand } from "@/core/components/brand";
import { AuthScreen } from "./components/auth-screen";
import { errorMessage } from "@/core/services/api-service";
const date = (v: string) =>
  format(new Date(v), "dd MMM yyyy", { locale: ptBR });
const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
const categories = [
  "Todos os livros",
  "Literatura",
  "Ficção",
  "Desenvolvimento pessoal",
  "História",
  "Design",
  "Ciência",
  "Tecnologia",
];
const titles: Record<View, string> = {
  catalog: "Explorar acervo",
  overview: "Visão geral",
  loans: "Empréstimos",
  users: "Usuários",
  notifications: "Notificações",
  profile: "Meu perfil",
};
export function Library() {
  const state = useLibrary();
  const {
    user,
    demo,
    books,
    loans,
    users,
    notifications,
    run,
    pending,
    notice,
    setNotice,
  } = state;
  const [view, setView] = useState<View>("catalog");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos os livros");
  const [availability, setAvailability] = useState("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(false);
  const [selected, setSelected] = useState<Book | null>(null);
  const [editing, setEditing] = useState<Book | undefined>();
  const [bookForm, setBookForm] = useState(false);
  const [userForm, setUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>();
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    action: () => Promise<unknown>;
  } | null>(null);
  const [deadline, setDeadline] = useState<Loan | null>(null);
  const [appointment, setAppointment] = useState<Loan | null>(null);
  useEffect(() => {
    if (selected || bookForm || userForm || confirm || deadline || appointment)
      setNotice("");
  }, [selected, bookForm, userForm, confirm, deadline, appointment, setNotice]);
  const loanDays = state.config.data?.policy?.loanDays ?? 14;
  const staff = user?.role === "ADMIN" || user?.role === "BIBLIOTECARIO";
  const active = loans.filter((l) => !l.returnedAt);
  const soon = active.filter(
    (l) => differenceInCalendarDays(new Date(l.dueAt), new Date()) <= 3,
  );
  const filtered = books
    .filter(
      (b) =>
        (category === "Todos os livros" || b.category === category) &&
        (availability === "all" ||
          b.available === (availability === "available")) &&
        `${b.title} ${b.author} ${b.isbn}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "pt-BR")
        : sort === "author"
          ? a.author.localeCompare(b.author, "pt-BR")
          : 0,
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * 8, currentPage * 8);
  function navigate(v: View) {
    setView(v);
    setMobile(false);
    setSearch("");
    setPage(1);
  }
  function changeRole(role: Role) {
    state.setDemoRole(role);
    navigate("catalog");
  }
  if (state.loading)
    return (
      <div className="loading-page">
        <Brand markOnly />
        <h1>Sua biblioteca, mais perto.</h1>
        <LoaderCircle className="spin" />
        <p>Preparando o acervo…</p>
      </div>
    );
  if (!user) return <AuthScreen error={state.error} />;
  const nav = [
    { id: "overview" as View, label: "Visão geral", icon: LayoutDashboard },
    { id: "catalog" as View, label: "Explorar acervo", icon: LibraryIcon },
    {
      id: "loans" as View,
      label: staff ? "Empréstimos" : "Meus empréstimos",
      icon: ArrowLeftRight,
    },
    { id: "notifications" as View, label: "Notificações", icon: Bell },
    ...(user.role === "ADMIN"
      ? [{ id: "users" as View, label: "Usuários", icon: Users }]
      : []),
  ];
  return (
    <div className={"app-shell " + (dark ? "dark" : "")}>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Fechar menu"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a href="/" aria-label="SIGB — início">
          <Brand />
        </a>
        <span className="sidebar-caption">SUA BIBLIOTECA DIGITAL</span>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={"nav-item " + (view === id ? "active" : "")}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "loans" && active.length > 0 && (
                <span className="nav-counter">{active.length}</span>
              )}
              {id === "notifications" &&
                notifications.some((n) => n.status === "PROCESSANDO") && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="reading-note">
            <span className="note-icon">
              <Leaf size={19} />
            </span>
            <h3>
              Conhecimento que
              <br />
              vai com você.
            </h3>
            <p>
              Uma boa leitura pode
              <br />
              mudar o seu dia.
            </p>
            <span className="note-line" />
          </div>
          <button
            className={"nav-item " + (view === "profile" ? "active" : "")}
            onClick={() => navigate("profile")}
          >
            <UserRound size={19} />
            <span>Meu perfil</span>
          </button>
          <button className="nav-item" onClick={() => setDark(!dark)}>
            {dark ? <Sun size={19} /> : <Moon size={19} />}
            <span>{dark ? "Tema claro" : "Tema escuro"}</span>
          </button>
          <div className="sidebar-user">
            <span className="avatar">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{roles[user.role]}</small>
            </div>
            {!demo && (
              <button
                className="icon-button"
                aria-label="Sair da conta"
                onClick={async () => {
                  try {
                    await service.logout();
                    state.client.clear();
                    navigate("catalog");
                  } catch (e) {
                    setNotice(errorMessage(e));
                  }
                }}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
          <small className="sidebar-footer">
            © {new Date().getFullYear()} SIGB · Feito para descobrir.
          </small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-button"
              aria-label="Abrir menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Biblioteca</span>
            <ChevronRight size={13} />
            <strong>{titles[view]}</strong>
          </div>
          <div className="top-actions">
            <span className="campus">
              <span />
              Biblioteca universitária
            </span>
            <button
              className="notification-button icon-button"
              aria-label="Abrir notificações"
              onClick={() => navigate("notifications")}
            >
              <Bell size={20} />
              {soon.length > 0 && <i />}
            </button>
            <button
              className="avatar small-avatar"
              onClick={() => navigate("profile")}
              aria-label="Abrir meu perfil"
            >
              {user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <span className="demo-dot" />
              Demonstração · Dados ilustrativos, sem conexão com o Neon
            </span>
            <label>
              <span>Visualizar como</span>
              <select
                aria-label="Perfil da demonstração"
                value={state.demoRole}
                onChange={(e) => changeRole(e.target.value as Role)}
              >
                <option value="ALUNO">Aluno</option>
                <option value="BIBLIOTECARIO">Bibliotecário</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </label>
          </div>
        )}
        <main className="content">
          {state.error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={18} />
              {errorMessage(state.error)}
              <button onClick={() => void state.client.invalidateQueries()}>
                Tentar novamente
              </button>
            </div>
          )}
          {view === "catalog" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">UM MUNDO DE POSSIBILIDADES</div>
                  <h1>
                    Sua próxima descoberta <span>está aqui.</span>
                  </h1>
                  <p>
                    Explore histórias, encontre novas ideias e leve o
                    conhecimento com você.
                  </p>
                </div>
                {staff && (
                  <button
                    className="button primary"
                    onClick={() => {
                      setEditing(undefined);
                      setBookForm(true);
                    }}
                  >
                    <Plus size={17} />
                    Cadastrar livro
                  </button>
                )}
              </div>
              <section className="hero">
                <div className="hero-content">
                  <span className="hero-kicker">
                    <span />
                    ENTRE PÁGINAS, NOVOS MUNDOS
                  </span>
                  <h2>
                    Grandes jornadas
                    <br />
                    começam com <em>um livro.</em>
                  </h2>
                  <p>
                    Do seu próximo favorito àquela leitura que surpreende.
                    <br />O próximo capítulo é você quem escolhe.
                  </p>
                  <button
                    onClick={() => {
                      setCategory("Todos os livros");
                      setAvailability("available");
                      setPage(1);
                      document.getElementById("catalog")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                  >
                    Encontre sua próxima leitura
                    <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <span className="orbit orbit-one" />
                  <span className="orbit orbit-two" />
                  <span className="star star-one">✦</span>
                  <span className="star star-two">✧</span>
                  <span className="hero-caption">
                    UM LIVRO. INFINITAS POSSIBILIDADES.
                  </span>
                  <img
                    className="hero-book hero-book-back"
                    src="/covers/habits.svg"
                    alt=""
                  />
                  <img
                    className="hero-book hero-book-front"
                    src="/covers/midnight.svg"
                    alt=""
                  />
                  <span className="floating-tag">
                    <BookOpen size={17} />
                    Seu próximo capítulo
                  </span>
                </div>
              </section>
              <section className="stats-row">
                <Stat
                  icon={LibraryIcon}
                  value={String(books.length).padStart(2, "0")}
                  label="Livros no acervo"
                  detail="Conhecimento para explorar"
                />
                <Stat
                  icon={BookOpen}
                  value={String(
                    books.filter((b) => b.available).length,
                  ).padStart(2, "0")}
                  label="Disponíveis agora"
                  detail="Prontos para uma nova história"
                />
                <Stat
                  icon={Bookmark}
                  value={String(active.length).padStart(2, "0")}
                  label={staff ? "Empréstimos ativos" : "Seus empréstimos"}
                  detail={
                    active.length
                      ? "Boas histórias em andamento"
                      : "Sua próxima leitura espera"
                  }
                />
              </section>
              {soon.length > 0 && (
                <button
                  className="due-notice"
                  onClick={() => navigate("loans")}
                >
                  <span className="notice-symbol">
                    <Clock size={18} />
                  </span>
                  <span>
                    <strong>Um lembrete para a sua leitura</strong>
                    <span>
                      {staff
                        ? `${soon.length} empréstimo(s) com prazo próximo ou vencido.`
                        : `“${soon[0].book.title}” está com a devolução próxima. Confira o prazo.`}
                    </span>
                  </span>
                  <span className="notice-link">
                    Ver empréstimos
                    <ArrowRight size={15} />
                  </span>
                </button>
              )}
              <section className="catalog" id="catalog">
                <div className="section-heading">
                  <div>
                    <h2>
                      Explore o acervo <span>{books.length} livros</span>
                    </h2>
                    <p>Uma estante cheia de novas possibilidades.</p>
                  </div>
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      aria-label="Buscar livros"
                      placeholder="Busque por título, autor ou ISBN"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                    />
                    {search && (
                      <button
                        className="icon-button"
                        onClick={() => setSearch("")}
                        aria-label="Limpar busca"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="catalog-filters">
                  <div className="category-tabs">
                    {categories
                      .filter(
                        (c) =>
                          c !== "Tecnologia" ||
                          books.some((b) => b.category === "Tecnologia"),
                      )
                      .map((c) => (
                        <button
                          className={category === c ? "selected" : ""}
                          key={c}
                          onClick={() => {
                            setCategory(c);
                            setPage(1);
                          }}
                        >
                          {c}
                        </button>
                      ))}
                  </div>
                  <label className="availability-filter">
                    <SlidersHorizontal size={15} />
                    <select
                      aria-label="Filtrar disponibilidade"
                      value={availability}
                      onChange={(e) => {
                        setAvailability(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">Todos os status</option>
                      <option value="available">Disponíveis</option>
                      <option value="unavailable">Indisponíveis</option>
                    </select>
                  </label>
                </div>
                <div className="results-bar">
                  <p>
                    Mostrando{" "}
                    <strong>
                      {filtered.length ? (currentPage - 1) * 8 + 1 : 0}–
                      {Math.min(currentPage * 8, filtered.length)}
                    </strong>{" "}
                    de <strong>{filtered.length}</strong> livros
                  </p>
                  <label>
                    Ordenar por:
                    <select
                      aria-label="Ordenar livros"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="recent">Mais recentes</option>
                      <option value="title">Título A–Z</option>
                      <option value="author">Autor A–Z</option>
                    </select>
                    <ChevronDown size={13} />
                  </label>
                </div>
                {shown.length ? (
                  <div className="book-grid">
                    {shown.map((book) => (
                      <article className="book-card" key={book.id}>
                        <button
                          className="book-visual"
                          onClick={() => setSelected(book)}
                          aria-label={"Ver detalhes de " + book.title}
                        >
                          <span
                            className={
                              "availability " +
                              (book.available ? "" : "unavailable")
                            }
                          >
                            <span />
                            {book.available ? "Disponível" : "Emprestado"}
                          </span>
                          {book.coverUrl ? (
                            <img
                              src={book.coverUrl}
                              alt={"Capa de " + book.title}
                            />
                          ) : (
                            <div className="cover-fallback">
                              <BookOpen size={35} />
                              <strong>{book.title}</strong>
                              <small>{book.author}</small>
                            </div>
                          )}
                          <span className="book-open-icon">
                            <ArrowUpRight size={17} />
                          </span>
                        </button>
                        <div className="book-info">
                          <span className="book-category">{book.category}</span>
                          <button
                            onClick={() => setSelected(book)}
                            className="book-title"
                          >
                            {book.title}
                          </button>
                          <p>{book.author}</p>
                          <div className="book-card-footer">
                            <span>
                              {book.year}
                              <span>·</span>
                              {book.pages} páginas
                            </span>
                            <button
                              onClick={() => setSelected(book)}
                              aria-label={"Abrir " + book.title}
                            >
                              <ArrowRight size={16} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={Search}
                    title="Nenhum livro encontrado"
                    text="Tente outro título, autor ou categoria."
                  />
                )}
                <div className="pagination">
                  <span>Uma nova descoberta a cada página.</span>
                  <div>
                    <button
                      className="icon-button"
                      disabled={currentPage === 1}
                      aria-label="Página anterior"
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        className={currentPage === p ? "selected" : ""}
                        onClick={() => setPage(p)}
                        aria-label={"Página " + p}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      className="icon-button"
                      disabled={currentPage === pages}
                      aria-label="Próxima página"
                      onClick={() => setPage(currentPage + 1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
          {view === "overview" && (
            <>
              <PageTitle
                kicker="SUA BIBLIOTECA EM MOVIMENTO"
                title={"Olá, " + user.name.split(" ")[0] + "."}
                text="Acompanhe leituras, prazos e tudo o que acontece na biblioteca."
              />
              <section className="stats-row">
                <Stat
                  icon={LibraryIcon}
                  value={String(books.length)}
                  label="Livros cadastrados"
                  detail="Todo o conhecimento do acervo"
                />
                <Stat
                  icon={ArrowLeftRight}
                  value={String(active.length)}
                  label="Empréstimos ativos"
                  detail="Histórias em circulação"
                />
                <Stat
                  icon={Clock}
                  value={String(soon.length)}
                  label="Prazos para acompanhar"
                  detail="Próximos ou vencidos"
                />
              </section>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Leituras em andamento</h2>
                    <p>Um olhar sobre os seus próximos capítulos.</p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => navigate("loans")}
                  >
                    Ver todos
                    <ArrowRight size={15} />
                  </button>
                </div>
                <LoanTable
                  loans={active.slice(0, 5)}
                  staff={!!staff}
                  pending={pending}
                  onAction={(l, a) =>
                    setConfirm({
                      title:
                        a === "confirm"
                          ? "Confirmar retirada"
                          : a === "return"
                            ? "Confirmar devolução"
                            : "Renovar empréstimo",
                      message:
                        a === "confirm"
                          ? `Confirmar que ${l.user.name} retirou “${l.book.title}”?`
                          : a === "return"
                            ? `Confirmar a devolução de “${l.book.title}”? A multa será calculada na data da devolução.`
                            : `O prazo será estendido em mais ${loanDays} dias. Cada empréstimo permite uma renovação, desde que esteja em dia.`,
                      action: () => service.changeLoan(l.id, a),
                    })
                  }
                  onDeadline={setDeadline}
                  onSchedule={setAppointment}
                />
              </section>
              <div className="discovery-panel">
                <BookOpen size={30} />
                <div>
                  <h2>Sempre há algo novo para descobrir.</h2>
                  <p>Encontre um livro que combine com o seu momento.</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => navigate("catalog")}
                >
                  Explorar acervo
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </>
          )}
          {view === "loans" && (
            <>
              <PageTitle
                kicker="CADA LEITURA TEM SUA HISTÓRIA"
                title={staff ? "Empréstimos da biblioteca" : "Meus empréstimos"}
                text={
                  staff
                    ? "Acompanhe retiradas, ajuste prazos e confirme devoluções."
                    : "Acompanhe seus livros, renove o prazo e consulte o histórico."
                }
              />
              <section className="stats-row">
                <Stat
                  icon={BookOpen}
                  value={String(active.length)}
                  label="Em andamento"
                  detail="Livros ainda não devolvidos"
                />
                <Stat
                  icon={Clock}
                  value={String(soon.length)}
                  label="Prazos próximos ou vencidos"
                  detail="Um lembrete para se organizar"
                />
                <Stat
                  icon={CheckCheck}
                  value={String(loans.filter((l) => l.returnedAt).length)}
                  label="Leituras concluídas"
                  detail="Capítulos que ficam com você"
                />
              </section>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Histórico de empréstimos</h2>
                    <p>
                      {staff
                        ? "A devolução é confirmada após o recebimento do exemplar."
                        : "Para devolver um livro, entregue o exemplar à biblioteca."}
                    </p>
                  </div>
                </div>
                <LoanTable
                  loans={loans}
                  staff={!!staff}
                  pending={pending}
                  onAction={(l, a) =>
                    setConfirm({
                      title:
                        a === "confirm"
                          ? "Confirmar retirada"
                          : a === "return"
                            ? "Confirmar devolução"
                            : "Renovar empréstimo",
                      message:
                        a === "confirm"
                          ? `Confirmar que ${l.user.name} retirou “${l.book.title}”?`
                          : a === "return"
                            ? `Confirmar que “${l.book.title}” foi recebido? Multa atual: ${money(l.fineCents)}.`
                            : `Estender o prazo em ${loanDays} dias? Uma renovação por empréstimo, sem atrasos ou bloqueio.`,
                      action: () => service.changeLoan(l.id, a),
                    })
                  }
                  onDeadline={setDeadline}
                  onSchedule={setAppointment}
                />
              </section>
              <p className="policy-note">
                <Shield size={15} />
                Multa diária por atraso. Após dois meses desde o empréstimo,
                novas retiradas são bloqueadas. Procure a biblioteca para
                regularizar.
              </p>
            </>
          )}
          {view === "users" && user.role === "ADMIN" && (
            <>
              <PageTitle
                kicker="PESSOAS QUE CONSTROEM A BIBLIOTECA"
                title="Usuários"
                text="Gerencie cadastros e permissões de acesso."
                action={
                  <button
                    className="button primary"
                    onClick={() => {
                      setEditingUser(undefined);
                      setUserForm(true);
                    }}
                  >
                    <Plus size={17} />
                    Adicionar usuário
                  </button>
                }
              />
              <div className="panel">
                <div className="section-heading">
                  <h2>
                    Comunidade{" "}
                    <span className="count-label">{users.length} usuários</span>
                  </h2>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Usuário</th>
                        <th>Perfil</th>
                        <th>Situação</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div className="table-user">
                              <span className="avatar small-avatar">
                                {u.name
                                  .split(" ")
                                  .map((s) => s[0])
                                  .slice(0, 2)
                                  .join("")}
                              </span>
                              <div>
                                <strong>{u.name}</strong>
                                <small>{u.email}</small>
                              </div>
                            </div>
                          </td>
                          <td>{roles[u.role]}</td>
                          <td>
                            <span
                              className={
                                "pill " + (u.blocked ? "warning" : "success")
                              }
                            >
                              {u.blocked ? "Bloqueado" : "Ativo"}
                            </span>
                          </td>
                          <td>
                            <div className="inline-actions">
                              <button
                                className="icon-button"
                                aria-label={"Editar " + u.name}
                                onClick={() => {
                                  setEditingUser(u);
                                  setUserForm(true);
                                }}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="icon-button danger"
                                aria-label={"Excluir " + u.name}
                                onClick={() =>
                                  setConfirm({
                                    title: "Excluir usuário",
                                    message: `Excluir o acesso de ${u.name}? O histórico de operações será preservado.`,
                                    action: () => service.deleteUser(u.id),
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!users.length && (
                  <Empty
                    icon={Users}
                    title="Nenhum usuário cadastrado"
                    text="Adicione o primeiro usuário da biblioteca."
                  />
                )}
              </div>
            </>
          )}
          {view === "notifications" && (
            <>
              <PageTitle
                kicker="TUDO EM DIA, SEM PERDER UM CAPÍTULO"
                title="Notificações"
                text="Lembretes de devolução e atualizações da sua biblioteca."
              />
              <div className="notification-list">
                {notifications.map((n) => (
                  <article className="notification-card" key={n.id}>
                    <span className="notification-symbol">
                      <Bell size={23} />
                    </span>
                    <div>
                      <div className="notification-title">
                        <h3>
                          {n.type === "PRAZO_PROXIMO"
                            ? "Sua leitura tem um lembrete"
                            : n.type === "BLOQUEIO_POR_ATRASO"
                              ? "Bloqueio por atraso"
                              : n.type.replaceAll("_", " ").toLowerCase()}
                        </h3>
                        <span
                          className={
                            "pill " +
                            (n.status === "ENVIADA"
                              ? "success"
                              : n.status === "FALHA"
                                ? "warning"
                                : "neutral")
                          }
                        >
                          {n.status === "ENVIADA"
                            ? "Enviada"
                            : n.status === "FALHA"
                              ? "Falha"
                              : "Processando"}
                        </span>
                      </div>
                      <p>{n.message}</p>
                      <small>
                        {date(n.createdAt)}
                        <span>·</span>
                        {n.deliveries
                          .map(
                            (d) =>
                              `${d.channel} · ${d.attempts}/3 tentativa(s)`,
                          )
                          .join(" | ")}
                      </small>
                      {staff && n.deliveries.some((d) => d.lastError) && (
                        <p className="delivery-error">
                          {n.deliveries
                            .filter((d) => d.lastError)
                            .map((d) => d.lastError)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {!notifications.length && (
                <Empty
                  icon={Bell}
                  title="Tudo tranquilo por aqui"
                  text="Seus lembretes e atualizações aparecerão nesta página."
                />
              )}
              {staff && (
                <p className="policy-note">
                  <Shield size={15} />
                  Envio assíncrono por e-mail, SMS ou WhatsApp. Até 3 tentativas
                  por destinatário e canal, com intervalos crescentes.
                </p>
              )}
            </>
          )}
          {view === "profile" && (
            <>
              <PageTitle
                kicker="SEU ESPAÇO NA BIBLIOTECA"
                title="Meu perfil"
                text="Mantenha seus dados atualizados para receber os lembretes de leitura."
              />
              <div className="profile-layout">
                <section className="profile-summary panel">
                  <span className="avatar profile-avatar">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <h2>{user.name}</h2>
                  <p>{user.email}</p>
                  <span className="pill neutral">{roles[user.role]}</span>
                  <div className="profile-status">
                    <Shield size={17} />
                    {user.blocked
                      ? "Conta bloqueada para empréstimos"
                      : "Conta ativa"}
                  </div>
                </section>
                <section className="panel profile-form">
                  <h2>Informações pessoais</h2>
                  <p>Seu perfil de acesso é definido pela administração.</p>
                  <UserForm
                    profile
                    user={user}
                    pending={pending}
                    run={run}
                    onDone={() => {}}
                  />
                </section>
              </div>
            </>
          )}
          <footer className="main-footer">
            <span>
              <Brand markOnly className="footer-brand" />
              SIGB <span>·</span> Conhecimento que conecta.
            </span>
            <span>
              Uma biblioteca. Infinitas possibilidades.
              <Heart size={12} />
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Fechar mensagem"
            onClick={() => setNotice("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {selected && (
        <Modal
          message={notice}
          title="Um novo capítulo espera por você"
          onClose={() => setSelected(null)}
        >
          <div className="book-detail">
            <div className="detail-cover">
              {selected.coverUrl ? (
                <img
                  src={selected.coverUrl}
                  alt={"Capa de " + selected.title}
                />
              ) : (
                <BookOpen size={60} />
              )}
            </div>
            <div>
              <span className="book-category">{selected.category}</span>
              <h2>{selected.title}</h2>
              <p className="detail-author">por {selected.author}</p>
              <span
                className={
                  "pill " + (selected.available ? "success" : "warning")
                }
              >
                {selected.available
                  ? "Disponível para empréstimo"
                  : "Livro indisponível"}
              </span>
              <p className="description">{selected.description}</p>
              <dl>
                <div>
                  <dt>Editora</dt>
                  <dd>{selected.publisher}</dd>
                </div>
                <div>
                  <dt>Ano</dt>
                  <dd>{selected.year}</dd>
                </div>
                <div>
                  <dt>Páginas</dt>
                  <dd>{selected.pages}</dd>
                </div>
                <div>
                  <dt>ISBN</dt>
                  <dd>{selected.isbn}</dd>
                </div>
              </dl>
              {!staff && (
                <button
                  className="button primary"
                  disabled={pending}
                  onClick={() => {
                    if (!selected.available) {
                      setSelected(null);
                      setNotice(
                        "Livro indisponível. Faça uma nova busca no acervo.",
                      );
                      setAvailability("available");
                      setCategory("Todos os livros");
                      setSearch("");
                      return;
                    }
                    setConfirm({
                      title: "Confirmar empréstimo",
                      message: `Deseja retirar “${selected.title}”? Prazo padrão: ${loanDays} dias. A devolução deve ser confirmada pela biblioteca.`,
                      action: async () => {
                        try {
                          await service.borrow(selected.id);
                        } catch (error) {
                          if (errorMessage(error) === "Livro indisponível") {
                            setConfirm(null);
                            navigate("catalog");
                            setAvailability("available");
                            setCategory("Todos os livros");
                            void state.client.invalidateQueries({
                              queryKey: ["books"],
                            });
                          }
                          throw error;
                        }
                      },
                    });
                    setSelected(null);
                  }}
                >
                  {selected.available ? (
                    <>
                      <Bookmark size={17} />
                      Confirmar empréstimo
                    </>
                  ) : (
                    <>
                      <Search size={17} />
                      Buscar outro livro
                    </>
                  )}
                </button>
              )}
              {staff && (
                <div className="detail-actions">
                  <button
                    className="button primary"
                    onClick={() => {
                      setEditing(selected);
                      setSelected(null);
                      setBookForm(true);
                    }}
                  >
                    <Pencil size={16} />
                    Editar livro
                  </button>
                  <button
                    className="button secondary danger"
                    onClick={() => {
                      const b = selected;
                      setSelected(null);
                      setConfirm({
                        title: "Excluir livro",
                        message: `Excluir “${b.title}” do acervo? O histórico será preservado.`,
                        action: () => service.deleteBook(b.id),
                      });
                    }}
                  >
                    <Trash2 size={16} />
                    Excluir
                  </button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
      {bookForm && (
        <Modal
          message={notice}
          title={editing ? "Editar livro" : "Adicionar ao acervo"}
          onClose={() => setBookForm(false)}
        >
          <BookForm
            book={editing}
            pending={pending}
            run={run}
            onDone={() => setBookForm(false)}
          />
        </Modal>
      )}
      {userForm && (
        <Modal
          message={notice}
          title={editingUser ? "Editar usuário" : "Adicionar usuário"}
          onClose={() => setUserForm(false)}
        >
          <UserForm
            user={editingUser}
            pending={pending}
            run={run}
            onDone={() => setUserForm(false)}
          />
        </Modal>
      )}
      {confirm && (
        <Modal
          message={notice}
          title={confirm.title}
          onClose={() => setConfirm(null)}
        >
          <div className="confirm-content">
            <span className="confirm-icon">
              <BookOpen size={28} />
            </span>
            <p>{confirm.message}</p>
            <div className="detail-actions">
              <button
                className="button secondary"
                onClick={() => setConfirm(null)}
              >
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={pending}
                onClick={async () => {
                  if (await run(confirm.action)) setConfirm(null);
                }}
              >
                {pending ? "Processando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {appointment && (
        <Modal
          message={notice}
          title="Agendar retirada do livro"
          onClose={() => setAppointment(null)}
        >
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const value = String(
                new FormData(e.currentTarget).get("pickupAt"),
              );
              if (
                await run(() =>
                  service.changeLoan(
                    appointment.id,
                    "schedule",
                    new Date(value).toISOString(),
                  ),
                )
              )
                setAppointment(null);
            }}
          >
            <p>
              {appointment.book.title} · {appointment.user.name}
            </p>
            <label>
              Dia e horário da retirada
              <input
                type="datetime-local"
                name="pickupAt"
                required
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                max={format(new Date(appointment.dueAt), "yyyy-MM-dd'T'HH:mm")}
              />
            </label>
            <button className="button primary" disabled={pending}>
              Agendar retirada
            </button>
          </form>
        </Modal>
      )}
      {deadline && (
        <Modal
          message={notice}
          title="Definir prazo de devolução"
          onClose={() => setDeadline(null)}
        >
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const v = String(new FormData(e.currentTarget).get("dueAt"));
              if (
                await run(() =>
                  service.changeLoan(
                    deadline.id,
                    "deadline",
                    new Date(v + "T23:59:00-03:00").toISOString(),
                  ),
                )
              )
                setDeadline(null);
            }}
          >
            <p>
              {deadline.book.title} · {deadline.user.name}
            </p>
            <label>
              Nova data de devolução
              <input
                type="date"
                name="dueAt"
                required
                min={format(new Date(Date.now() + 86400000), "yyyy-MM-dd")}
                max={format(new Date(Date.now() + 90 * 86400000), "yyyy-MM-dd")}
                defaultValue={format(new Date(deadline.dueAt), "yyyy-MM-dd")}
              />
            </label>
            <button className="button primary" disabled={pending}>
              Salvar prazo
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
