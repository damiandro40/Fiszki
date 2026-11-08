import type { RefObject } from 'react'
import { LoaderCircle, Sparkles } from 'lucide-react'
import type { AiHistoryMessage } from '../../types/model'
import MessageContent from './MessageContent'

interface AIMessageListProps {
  scrollRef: RefObject<HTMLDivElement>
  loaded: boolean
  messages: AiHistoryMessage[]
}

const AIMessageList = ({ scrollRef, loaded, messages }: AIMessageListProps) => (
  <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto scroll-smooth px-4 py-6" ref={scrollRef}>
          {!loaded && <div className="m-auto flex flex-col items-center justify-center gap-3 p-5 text-center text-[var(--muted)] [&_svg]:text-[var(--accent-ink)] [&_h2]:m-0 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-[var(--text)] [&_p]:m-0 [&_p]:max-w-[330px] [&_p]:text-xs [&_p]:leading-relaxed" role="status"><LoaderCircle className="spinning" size={23}/> Wczytywanie rozmowy…</div>}
          {loaded && !messages.length && <div className="m-auto flex flex-col items-center justify-center gap-3 p-5 text-center text-[var(--muted)] [&_svg]:text-[var(--accent-ink)] [&_h2]:m-0 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-[var(--text)] [&_p]:m-0 [&_p]:max-w-[330px] [&_p]:text-xs [&_p]:leading-relaxed"><Sparkles size={30}/><h2>Co opracowujemy?</h2><p>Wklej tekst albo dodaj materiały. Asystent domyślnie tworzy fiszki w wybranym zestawie i dobiera ich liczbę do zakresu treści.</p></div>}
          {messages.map(message => <div className={`min-w-[80px] ${message.role === 'user' ? 'max-w-[88%] self-end' : 'max-w-full self-start'}`} key={message.id}>
            <div className={`whitespace-pre-wrap break-words text-[12.5px] leading-[1.75] text-[var(--text)] ${message.role === 'user' ? 'rounded-2xl rounded-tr-md bg-[var(--surface-3)] px-4 py-3' : 'px-1.5 py-1'}`}>{message.content ? <MessageContent content={message.content}/> : message.role === 'user' ? 'Załączone materiały' : <LoaderCircle size={17} className="spinning"/>}</div>
            {!!message.attachments?.length && <div className="mt-1.5 flex flex-wrap gap-1.5">{message.attachments.map(item => <div className="flex max-w-[120px] flex-col gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1.5 [&_img]:size-9 [&_img]:rounded-md [&_img]:object-cover [&_small]:truncate [&_small]:text-[10px] [&_small]:text-[var(--muted)]" key={item.id} title={item.name}>
              {item.dataUrl ? <img src={item.dataUrl} alt={item.name}/> : <span>📄</span>}<small>{item.name}</small>
            </div>)}</div>}
          </div>)}
  </div>
)

export default AIMessageList
