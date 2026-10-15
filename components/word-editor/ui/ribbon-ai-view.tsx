'use client';

import type { Editor } from '@tiptap/react';
import {
  BookOpen,
  FileText,
  Languages,
  LayoutGrid,
  ListTree,
  Maximize,
  Maximize2,
  MessageSquareText,
  Monitor,
  Moon,
  MoveHorizontal,
  Plug,
  Plus,
  SpellCheck,
  Sparkles,
  Sun,
  Trash,
  WandSparkles,
  Wand,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { ACTIONS, LANGUAGES, translateAction, type QuickAction } from '../ai/prompts';
import { loadCustomActions, saveCustomActions } from '../ai/storage';
import { PROVIDER_LABEL } from '../ai/types';
import { Btn, Combo, Dropdown, Group, MenuItem, MenuSeparator, MiniForm, Row } from './controls';
import type { RibbonProps } from './Ribbon';
import { Check } from './ribbon-tabs';

const ICON = 16;
const ICON_LG = 22;

// ---------------------------------------------------------------------------
// Tabla de contenido (sin IA): títulos del documento con su número de página
// ---------------------------------------------------------------------------

export function insertTableOfContents(editor: Editor) {
  const headings: { text: string; level: number; page: number }[] = [];
  const dom = editor.view.dom;
  const rect = dom.getBoundingClientRect();
  const scale = rect.height / (dom.offsetHeight || 1) || 1;
  const pitch = (editor.storage as unknown as { pagination?: { config: { pitch: number } } }).pagination?.config.pitch || 0;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return true;
    let page = 1;
    if (pitch) {
      try {
        page = Math.floor((editor.view.coordsAtPos(pos + 1).top - rect.top) / scale / pitch) + 1;
      } catch {
        page = 1;
      }
    }
    headings.push({ text: node.textContent.trim(), level: node.attrs.level as number, page });
    return false;
  });
  if (!headings.length) return false;
  const escape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html =
    '<h2>Tabla de contenido</h2>' +
    headings
      .filter((h) => h.text)
      .map(
        (h) =>
          `<p data-spacing="none" data-indent="${h.level - 1}" style="margin-left: ${(h.level - 1) * 1.25}cm">${escape(h.text)} … ${h.page}</p>`,
      )
      .join('') +
    '<p></p>';
  editor.chain().focus().insertContent(html).run();
  return true;
}

// ---------------------------------------------------------------------------
// Herramientas de IA
// ---------------------------------------------------------------------------

function CustomActionForm({ onSave }: { onSave: (action: QuickAction) => void }) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [transforms, setTransforms] = useState(true);
  return (
    <MiniForm
      className="we-inline-form"
      onSubmit={() => {
        if (!name.trim() || !prompt.trim()) return;
        onSave({ id: `custom-${Date.now()}`, label: name.trim().slice(0, 40), prompt: prompt.trim().slice(0, 2000), transforms });
        setName('');
        setPrompt('');
      }}
    >
      <div className="we-menu-title">Crear acción rápida</div>
      <label>
        Nombre
        <input value={name} maxLength={40} placeholder="Ej.: Redactar como oficio" onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Instrucción para la IA
        <textarea
          rows={3}
          value={prompt}
          maxLength={2000}
          placeholder="Ej.: Reescribe el texto con formato de oficio dirigido a una autoridad, con saludo y despedida."
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>
      <Check label="El resultado reemplaza al texto seleccionado" checked={transforms} onChange={setTransforms} />
      <div className="we-inline-actions">
        <button type="button" data-submit className="we-primary">Guardar acción</button>
      </div>
    </MiniForm>
  );
}

export function AiTab({ editor, ai, view, onView, actions, notify }: RibbonProps) {
  const [custom, setCustom] = useState<QuickAction[]>(() => loadCustomActions());
  if (!ai) return null;

  const run = (action: QuickAction) => {
    if (!ai.ready) return actions.openAiConnect();
    onView({ rightPanel: true });
    ai.runAction(action);
  };

  return (
    <>
      <Group label="Chat">
        <Btn title="Chat de IA" size="lg" label="Chat de IA" active={view.rightPanel} onClick={() => onView({ rightPanel: !view.rightPanel })}>
          <MessageSquareText size={ICON_LG} />
        </Btn>
        <Btn
          title={ai.ready && ai.connection ? `Conectado a ${PROVIDER_LABEL[ai.connection.provider]}` : 'Conectar Claude o Gemini'}
          size="lg"
          label={ai.ready && ai.connection ? PROVIDER_LABEL[ai.connection.provider] : 'Conectar'}
          className={ai.ready ? 'is-connected' : ''}
          onClick={actions.openAiConnect}
        >
          <Plug size={ICON_LG} />
        </Btn>
      </Group>

      <Group label="Redacción">
        <Btn title="Resumir (la selección o todo el documento)" size="lg" label="Resumir" onClick={() => run(ACTIONS.summarize)}>
          <FileText size={ICON_LG} />
        </Btn>
        <Dropdown title="Reescribir" size="lg" label="Reescribir" trigger={<WandSparkles size={ICON_LG} />}>
          {(close) => (
            <>
              {[ACTIONS.improve, ACTIONS.formal, ACTIONS.friendly, ACTIONS.shorter, ACTIONS.longer, ACTIONS.simplify].map((a) => (
                <MenuItem key={a.id} onSelect={() => { close(); run(a); }}>
                  {a.label}
                </MenuItem>
              ))}
            </>
          )}
        </Dropdown>
        <Dropdown title="Traducir" size="lg" label="Traducir" trigger={<Languages size={ICON_LG} />}>
          {(close) => (
            <>
              {LANGUAGES.map((lang) => (
                <MenuItem key={lang} onSelect={() => { close(); run(translateAction(lang)); }}>
                  Al {lang}
                </MenuItem>
              ))}
            </>
          )}
        </Dropdown>
        <Btn title="Gramática y ortografía" size="lg" label="Gramática y ortografía" onClick={() => run(ACTIONS.grammar)}>
          <SpellCheck size={ICON_LG} />
        </Btn>
      </Group>

      <Group label="Generar">
        <Dropdown title="Generar" size="lg" label="Generar" trigger={<Sparkles size={ICON_LG} />}>
          {(close) => (
            <>
              {[ACTIONS.executive, ACTIONS.keyPoints, ACTIONS.titles, ACTIONS.review].map((a) => (
                <MenuItem key={a.id} onSelect={() => { close(); run(a); }}>
                  {a.label}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem
                icon={<ListTree size={ICON} />}
                hint="sin IA"
                onSelect={() => {
                  close();
                  if (!insertTableOfContents(editor)) notify('No hay títulos: aplica Título 1–4 a los encabezados del texto.');
                }}
              >
                Tabla de contenido
              </MenuItem>
            </>
          )}
        </Dropdown>
        <Dropdown title="Acciones rápidas" size="lg" label="Acciones rápidas" trigger={<Zap size={ICON_LG} />} panelClassName="we-quick-actions">
          {(close) => (
            <>
              {custom.length ? (
                custom.map((a) => (
                  <div key={a.id} className="we-qa-row">
                    <MenuItem icon={<Wand size={ICON} />} onSelect={() => { close(); run(a); }}>
                      {a.label}
                    </MenuItem>
                    <button
                      type="button"
                      className="we-icon-btn"
                      aria-label={`Eliminar ${a.label}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const next = custom.filter((c) => c.id !== a.id);
                        setCustom(next);
                        saveCustomActions(next);
                      }}
                    >
                      <Trash size={13} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="we-menu-empty">Aún no tienes acciones rápidas. Crea una con tu propia instrucción.</p>
              )}
              <MenuSeparator />
              <CustomActionForm
                onSave={(a) => {
                  const next = [...custom, a];
                  setCustom(next);
                  saveCustomActions(next);
                  notify(`Acción «${a.label}» guardada`);
                }}
              />
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Ayuda">
        <div className="we-ai-hint">
          Selecciona un texto para trabajar solo con él;
          <br />
          sin selección se usa todo el documento.
        </div>
      </Group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Vista
// ---------------------------------------------------------------------------

const ZOOMS = ['50', '75', '100', '125', '150', '200'];

export function ViewTab({ view, onView, actions }: RibbonProps) {
  const pct = Math.round(view.zoom * 100);
  return (
    <>
      <Group label="Navegación">
        <Btn title="Panel de títulos" size="lg" label="Títulos" active={view.leftPanel} onClick={() => onView({ leftPanel: !view.leftPanel })}>
          <ListTree size={ICON_LG} />
        </Btn>
      </Group>

      <Group label="Zoom">
        <div className="we-col we-col-gap">
          <Row>
            <Combo
              title="Zoom"
              width={78}
              inputMode="decimal"
              value={`${pct}%`}
              options={ZOOMS.map((z) => `${z}%`)}
              onCommit={(v) => {
                const n = parseFloat(v.replace(',', '.'));
                if (n >= 25 && n <= 300) onView({ zoom: n / 100 });
              }}
            />
            <Btn title="Ajustar a la página" label="Ajustar a la página" onClick={actions.fitPage}>
              <Maximize size={ICON} />
            </Btn>
          </Row>
          <Row>
            <Btn title="Ampliar al 100 %" label="Ampliar al 100 %" onClick={() => onView({ zoom: 1 })}>
              <span className="we-zoom-badge">100</span>
            </Btn>
            <Btn title="Ajustar al ancho" label="Ajustar al ancho" onClick={actions.fitWidth}>
              <MoveHorizontal size={ICON} />
            </Btn>
          </Row>
        </div>
        <Btn title="Múltiples páginas" size="lg" label="Múltiples páginas" active={view.multiPage} onClick={() => onView({ multiPage: !view.multiPage })}>
          <LayoutGrid size={ICON_LG} />
        </Btn>
      </Group>

      <Group label="Tema">
        <Dropdown
          title="Tema de la interfaz"
          size="lg"
          label="Tema de la interfaz"
          trigger={view.theme === 'dark' ? <Moon size={ICON_LG} /> : view.theme === 'light' ? <Sun size={ICON_LG} /> : <Monitor size={ICON_LG} />}
        >
          {(close) => (
            <>
              <MenuItem icon={<Sun size={ICON} />} active={view.theme === 'light'} onSelect={() => { close(); onView({ theme: 'light' }); }}>
                Claro
              </MenuItem>
              <MenuItem icon={<Moon size={ICON} />} active={view.theme === 'dark'} onSelect={() => { close(); onView({ theme: 'dark' }); }}>
                Oscuro
              </MenuItem>
              <MenuItem icon={<Monitor size={ICON} />} active={view.theme === 'system'} onSelect={() => { close(); onView({ theme: 'system' }); }}>
                Según el sistema
              </MenuItem>
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Mostrar">
        <div className="we-grid2 we-grid2-left">
          <Check label="Barra de herramientas siempre visible" checked={view.ribbonPinned} onChange={(v) => onView({ ribbonPinned: v })} />
          <Check label="Panel izquierdo" checked={view.leftPanel} onChange={(v) => onView({ leftPanel: v })} />
          <Check label="Barra de estado" checked={view.showStatusBar} onChange={(v) => onView({ showStatusBar: v })} />
          <Check label="Panel derecho" checked={view.rightPanel} onChange={(v) => onView({ rightPanel: v })} />
          <Check label="Reglas" checked={view.showRuler} onChange={(v) => onView({ showRuler: v })} />
          <Check label="Marcas de formato" checked={view.showMarks} onChange={(v) => onView({ showMarks: v })} />
        </div>
      </Group>

      <Group label="Vistas">
        <Btn title="Modo lectura" size="lg" label="Modo lectura" active={view.readMode} onClick={() => onView({ readMode: !view.readMode })}>
          <BookOpen size={ICON_LG} />
        </Btn>
        <Btn title="Pantalla completa" size="lg" label="Pantalla completa" onClick={actions.toggleFullscreen}>
          <Maximize2 size={ICON_LG} />
        </Btn>
      </Group>
    </>
  );
}

