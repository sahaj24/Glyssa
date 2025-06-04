// Global type declarations

// Web Speech API
interface Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

// Monaco Editor types
declare module '@monaco-editor/react' {
  import { editor } from 'monaco-editor';
  
  export interface EditorProps {
    height: string | number;
    width?: string | number;
    value?: string;
    defaultValue?: string;
    language?: string;
    theme?: string;
    options?: editor.IStandaloneEditorConstructionOptions;
    overrideServices?: editor.IEditorOverrideServices;
    onChange?: (value: string, event: editor.IModelContentChangedEvent) => void;
    onMount?: (editor: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => void;
    className?: string;
    beforeMount?: (monaco: typeof import('monaco-editor')) => void;
    onValidate?: (markers: editor.IMarker[]) => void;
  }
  
  export default function Editor(props: EditorProps): JSX.Element;
  
  export function loader(params: any): any;
  export function DiffEditor(props: any): JSX.Element;
}
