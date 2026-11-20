import { useEffect, useState } from 'react'

type Msg = { id: number; author: string; text: string; time: string }

export default function App() {
  const [name, setName] = useState('')
  const [logged, setLogged] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('flux_user')
    if (saved) {
      setName(saved)
      setLogged(true)
    }
    const raw = localStorage.getItem('flux_msgs')
    if (raw) setMessages(JSON.parse(raw))
  }, [])

  const login = () => {
    if (!name.trim()) return
    localStorage.setItem('flux_user', name.trim())
    setLogged(true)
  }

  const send = () => {
    if (!text.trim()) return
    const msg: Msg = {
      id: Date.now(),
      author: name,
      text: text.trim(),
      time: new Date().toLocaleTimeString().slice(0, 5),
    }
    const next = [...messages, msg]
    setMessages(next)
    localStorage.setItem('flux_msgs', JSON.stringify(next))
    setText('')
  }

  if (!logged) {
    return (
      <div style={styles.screen}>
        <div style={styles.card}>
          <h1 style={styles.title}>Fluxgrams</h1>
          <p style={styles.subtitle}>Вход в мессенджер</p>
          <input
            style={styles.input}
            placeholder="Твоё имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
          />
          <button style={styles.button} onClick={login}>
            Войти
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.screen}>
      <div style={styles.chat}>
        <div style={styles.header}>
          <span style={styles.headerName}>Чат</span>
          <span style={{ color: '#9d8fff' }}>{name}</span>
        </div>
        <div style={styles.messages}>
          {messages.length === 0 && (
            <p style={styles.empty}>Сообщений пока нет. Напиши первое!</p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                ...styles.bubble,
                ...(m.author === name ? styles.bubbleMine : styles.bubbleOther),
              }}
            >
              <div style={styles.author}>{m.author}</div>
              <div>{m.text}</div>
              <div style={styles.time}>{m.time}</div>
            </div>
          ))}
        </div>
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder="Сообщение..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button style={styles.sendBtn} onClick={send}>
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  screen: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #0f0c29, #302b63, #24243e)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Arial, sans-serif',
    padding: '1rem',
    boxSizing: 'border-box',
  },
  card: {
    background: '#1a1830',
    padding: '2rem',
    borderRadius: '20px',
    width: '100%',
    maxWidth: '360px',
    textAlign: 'center',
    color: '#fff',
  },
  title: { margin: 0, fontSize: '2.2rem', color: '#9d8fff' },
  subtitle: { color: '#8886aa', margin: '0.5rem 0 1.5rem' },
  chat: {
    width: '100%',
    maxWidth: '420px',
    height: '80vh',
    background: '#1a1830',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    color: '#fff',
  },
  header: {
    padding: '1rem',
    background: '#221f40',
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 'bold',
  },
  headerName: { color: '#fff' },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  empty: { color: '#8886aa', textAlign: 'center', marginTop: '2rem' },
  bubble: {
    padding: '10px 14px',
    borderRadius: '16px',
    maxWidth: '75%',
    fontSize: '0.95rem',
  },
  bubbleMine: { alignSelf: 'flex-end', background: '#7c5cff' },
  bubbleOther: { alignSelf: 'flex-start', background: '#2c2a52' },
  author: { fontSize: '0.7rem', opacity: 0.7, marginBottom: '2px' },
  time: { fontSize: '0.65rem', opacity: 0.6, textAlign: 'right', marginTop: '2px' },
  row: { display: 'flex', padding: '0.7rem', gap: '8px', background: '#221f40' },
  input: {
    flex: 1,
    padding: '12px 14px',
    borderRadius: '25px',
    border: 'none',
    outline: 'none',
    background: '#2c2a52',
    color: '#fff',
    fontSize: '1rem',
  },
  button: {
    width: '100%',
    padding: '13px',
    borderRadius: '25px',
    border: 'none',
    background: '#7c5cff',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  sendBtn: {
    width: '46px',
    borderRadius: '50%',
    border: 'none',
    background: '#7c5cff',
    color: '#fff',
    fontSize: '1.1rem',
    cursor: 'pointer',
  },
}
