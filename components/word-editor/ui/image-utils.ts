import type { Editor } from '@tiptap/react';

export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Inserta una imagen (archivo local) como data URL en el editor indicado. */
export async function insertImageFile(editor: Editor, file: File, notify: (m: string) => void) {
  if (!file.type.startsWith('image/')) return notify('El archivo no es una imagen');
  if (file.size > 8 * 1024 * 1024) return notify('La imagen supera 8 MB');
  const src = await readImageFile(file);
  editor.chain().focus().setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') }).run();
}
