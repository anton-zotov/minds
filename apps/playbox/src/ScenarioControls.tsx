import { useState } from 'react';
import type { Injection } from '../server/host';
export function ScenarioControls({ disabled, inject }: { disabled: boolean; inject: (input: Injection) => Promise<void> }) {
  const [content, setContent] = useState(''); const [recipients, setRecipients] = useState(['marta', 'ivo']);
  return <form className="event-form" noValidate onSubmit={event => { event.preventDefault(); void inject({ content, recipients }); }}>
    <label htmlFor="content">Observation content</label><textarea id="content" value={content} onChange={e => setContent(e.target.value)} placeholder="What does the character observe?" rows={4} maxLength={10000} disabled={disabled} />
    <fieldset disabled={disabled}><legend>Recipients</legend>{['marta', 'ivo'].map(id => <label className="recipient" key={id}><input type="checkbox" checked={recipients.includes(id)} onChange={e => setRecipients(current => e.target.checked ? [...current, id] : current.filter(r => r !== id))} />{id === 'marta' ? 'Marta' : 'Ivo'}</label>)}</fieldset>
    <p>The Mind interprets the observation and judges whether its strategies are fulfilled.</p>
    <button className="sidebar-button" type="submit" disabled={disabled}>Inject observation <span>↗</span></button>
  </form>;
}

