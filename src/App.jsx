import React, { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Rnd } from 'react-rnd'
import html2canvas from 'html2canvas'
import toast, { Toaster } from 'react-hot-toast'

const translateToHindi = async (text) => {
  if (!text) return text
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(
        text
      )}`
    )
    const data = await res.json()
    // data[0][0][0] usually holds the translated text
    return (data && data[0] && data[0][0] && data[0][0][0]) || text
  } catch (e) {
    console.warn('translation failed', e)
    return text
  }
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [birthdays, setBirthdays] = useState([])
  const [todayBirthdays, setTodayBirthdays] = useState([])
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fontSize, setFontSize] = useState(46)
  const [rndState, setRndState] = useState({ x: 200, y: 500, width: 400, height: 80 })
  const [editableName, setEditableName] = useState('')
  const cardRef = useRef(null)

  useEffect(() => {
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('birthdayAuth='));
    if (cookie && cookie.split('=')[1] === import.meta.env.VITE_BIRTHDAY_PASSWORD) {
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    const loadExcel = async () => {
      try {
        const res = await fetch('/Birthday_List.xlsx')
        if (!res.ok) throw new Error('Birthday_List.xlsx not found in public folder')
        const ab = await res.arrayBuffer()
        const wb = XLSX.read(ab, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        setBirthdays(data)
      } catch (e) {
        console.error(e)
        toast.error('Failed to load Birthday_List.xlsx — put it in /public folder')
      } finally {
        setLoading(false)
      }
    }
    loadExcel()
  }, [])

  useEffect(() => {
    if (!birthdays.length) return
    const today = new Date()
    const d = today.getDate()
    const m = today.getMonth() + 1

    const matches = birthdays.filter((row) => {
      // try a few field names
      const dateValue = row.Date || row.date || row.DOB || row.dob || row.Birthday || row.birthday
      if (!dateValue) return false

      let day = null
      let month = null

      if (typeof dateValue === 'number') {
        // Excel serial date
        const parsed = XLSX.SSF.parse_date_code(dateValue)
        day = parsed.d
        month = parsed.m
      } else {
        // string
        const clean = String(dateValue).trim()
        const sep = clean.includes('/') ? '/' : clean.includes('-') ? '-' : null
        if (!sep) return false
        const parts = clean.split(sep).map((p) => p.trim())
        if (parts.length === 3) {
          // could be yyyy-mm-dd or dd-mm-yyyy
          if (parts[0].length === 4) {
            month = parseInt(parts[1], 10)
            day = parseInt(parts[2], 10)
          } else {
            day = parseInt(parts[0], 10)
            month = parseInt(parts[1], 10)
          }
        } else if (parts.length === 2) {
          day = parseInt(parts[0], 10)
          month = parseInt(parts[1], 10)
        }
      }

      return day === d && month === m
    })

    const addHindi = async () => {
      const results = await Promise.all(
        matches.map(async (p) => {
          const en = p.Name || p.name || p.FullName || p.fullname || p['Full Name'] || ''
          const hindi = await translateToHindi(en)
          return { ...p, _enName: en, hindiName: hindi }
        })
      )
      setTodayBirthdays(results)
    }

    addHindi()
  }, [birthdays])

  useEffect(() => {
    if (selected) {
      setEditableName("श्री "+selected.hindiName || "श्री "+selected._enName || '')
      setRndState({ x:80, y: 250, width: 250, height: 80 })
      setFontSize(46)
    }
  }, [selected])

  const download = async () => {
    if (!cardRef.current) return
    try {
      const canvas = await html2canvas(cardRef.current, { useCORS: true })
      const link = document.createElement('a')
      const safe = (editableName || 'greeting').replace(/\s+/g, '_')
      link.download = `${safe}_birthday.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      toast.success('Downloaded!')
    } catch (e) {
      console.error(e)
      toast.error('Failed to render image — check console for CORS issues on template image')
    }
  }

  const handleLogin = () => {
    if (passwordInput === import.meta.env.VITE_BIRTHDAY_PASSWORD) {
      document.cookie = `birthdayAuth=${passwordInput}; path=/; max-age=${60*60*24}`; // 1 day
      setAuthenticated(true);
      toast.success('Welcome!');
    } else {
      toast.error('Wrong password!');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter"){
      handleLogin()
    }
  }

  if (!authenticated) {
    return (
      <div className="app-root flex items-center justify-center" style={{ minHeight:'100vh' }}>
        <Toaster />
        <div className="pass" style={{ maxWidth:'320px', textAlign:'center' }}>
          <h2>🔒 Enter Password</h2>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="controls-input"
            placeholder="Password"
            style={{ marginTop:'12px' }}
            autoFocus
          />
          <button className="primary" style={{ marginTop:'12px', width:'100%' }} onClick={handleLogin}>
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <Toaster />
      <header className="topbar">
        <h1>MPGB Birthday Greetings</h1>
        <div className="sub">Open on phone or PC — responds to today&apos;s date</div>
      </header>

      <main className="container">
        {loading ? (
          <div className="panel">Loading...</div>
        ) : (
          <>
            <section className="panel">
              <h2>Birthdays Today</h2>
              {todayBirthdays.length ? (
                <div className="grid">
                  {todayBirthdays.map((p, i) => (
                    <button
                      key={i}
                      className="person"
                      onClick={() => setSelected(p)}
                    >
                      <div className="name">{p._enName || p.Name || p.name}</div>
                      <div className="meta">{p.hindiName || '—'}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="muted">No birthdays today 🎈</div>
              )}
            </section>

            <section className="panel">
              <h2>Greeting Card</h2>

              {!selected ? (
                <div className="muted">Select a person to create a greeting</div>
              ) : (
                <div className="card-area">
                  <div className="controls">
                    <label>Editable Hindi name</label>
                    <input value={editableName} className='name' onChange={(e) => setEditableName(e.target.value)} />

                    <label>Font size: {fontSize}px</label>
                    <input type="range" min="24" max="120" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />

                    <div className="buttons">
                      <button onClick={download} className="primary">Download</button>
                      <button onClick={() => setSelected(null) } className="secondary">Close</button>
                    </div>
                  </div>

                  <div className="preview">
                    <div className="card-frame" ref={cardRef}>
                      <img src="/Template_Birthday_Greeting.png" alt="template" className="template" crossOrigin="anonymous" />

                      <Rnd
                        size={{ width: rndState.width, height: rndState.height }}
                        position={{ x: rndState.x, y: rndState.y }}
                        onDragStop={(e, d) => setRndState((s) => ({ ...s, x: d.x, y: d.y }))}
                        onResizeStop={(e, dir, ref, delta, pos) => {
                          setRndState({
                            x: pos.x,
                            y: pos.y,
                            width: parseInt(ref.style.width, 10),
                            height: parseInt(ref.style.height, 10),
                          })
                        }}
                        bounds="parent"
                      >
                        <div
                          className="greeting-text"
                          style={{
                            fontSize: fontSize + 'px',
                            fontFamily: "'Martel Sans', sans-serif",
                            color: '#1d5c96',
                            textAlign: 'center',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            lineHeight: 1,
                            marginLeft: '-20px',
                          }}

                        >
                          {editableName}
                        </div>
                      </Rnd>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>

    </div>
  )
}