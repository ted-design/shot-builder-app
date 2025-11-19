import { useState } from "react";
import RichTextEditor from "../../components/shots/RichTextEditor";
import { useTheme } from "../../context/ThemeContext";

export default function RichTextEditorDemo() {
  const [value, setValue] = useState(
    "<p>Select some of this text to open the inline bubble. Try bold/italic/link.</p><ul><li>Bullet item one</li><li>Bullet item two</li></ul>"
  );
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">RichTextEditor Bubble Demo</h1>
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Toggle theme (current: {theme})
        </button>
      </div>

      <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
        <RichTextEditor value={value} onChange={setValue} />
      </div>

      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        Instructions: click into the editor, select any word to show the bubble toolbar. In both light and dark
        themes, icons and text in the bubble should be clearly visible (white on dark background) and outlines should
        not appear filled.
      </p>
    </div>
  );
}

