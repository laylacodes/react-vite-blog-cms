import { useEditor, EditorContent, Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import CodeBlock from "@tiptap/extension-code-block";
import Image from "@tiptap/extension-image";
import Heading from "@tiptap/extension-heading";
import { forwardRef, useImperativeHandle, useState } from "react";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { textblockTypeInputRule } from "@tiptap/core";
import { EmbedModal } from "./EmbedModal";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onInsertMedia: () => void;
}

export interface RichTextEditorHandle {
  insertContent: (html: string) => boolean;
  getEditor: () => Editor | null;
}

// Re-add Markdown-style "# " shortcuts for headings (StarterKit's heading is
// disabled below so we can control the available levels).
const CustomHeading = Heading.extend({
  addInputRules() {
    return [1, 2, 3, 4, 5, 6].map((level) =>
      textblockTypeInputRule({
        find: new RegExp(`^(#{${level}})\\s$`),
        type: this.type,
        getAttributes: () => ({ level }),
      }),
    );
  },
});

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ content, onChange, onInsertMedia }, ref) => {
    const [embedModalOpen, setEmbedModalOpen] = useState(false);
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          heading: false,
        }),
        CustomHeading.configure({ levels: [1, 2, 3, 4] }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { class: "text-primary underline" },
        }),
        CodeBlock.configure({
          HTMLAttributes: { class: "bg-muted p-4 rounded-lg font-mono text-sm" },
        }),
        Image.configure({
          HTMLAttributes: { class: "max-w-full rounded-lg my-4" },
          inline: false,
        }),
      ],
      content,
      onUpdate: ({ editor }) => onChange(editor.getHTML()),
      editorProps: {
        attributes: {
          class: "prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none min-h-[400px] p-4 focus:outline-none",
        },
      },
    });

    useImperativeHandle(
      ref,
      () => ({
        insertContent: (html: string) => {
          if (!editor) return false;
          editor.chain().focus().insertContent(html).run();
          return true;
        },
        getEditor: () => editor,
      }),
      [editor],
    );

    if (!editor) return null;

    const setLink = () => {
      const previousUrl = editor.getAttributes("link").href;
      const url = window.prompt("URL", previousUrl);
      if (url === null) return;
      if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    };

    const handleInsertEmbed = (iframeHtml: string) => {
      editor.chain().focus().insertContent(iframeHtml).run();
    };

    const ToolbarButton = ({
      onClick,
      isActive = false,
      children,
      title,
    }: {
      onClick: () => void;
      isActive?: boolean;
      children: React.ReactNode;
      title: string;
    }) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClick}
        title={title}
        className={cn("h-8 w-8 p-0", isActive && "bg-muted text-primary")}
      >
        {children}
      </Button>
    );

    return (
      <div className="border border-border rounded-lg bg-background flex flex-col max-h-[calc(100vh-200px)] overflow-hidden">
        {/* Bubble menu — appears when text is selected */}
        {editor && (
          <BubbleMenu
            editor={editor}
            className="flex items-center gap-1 p-1 bg-background border border-border rounded-lg shadow-lg"
          >
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold">
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic">
              <Italic className="h-4 w-4" />
            </ToolbarButton>

            <div className="w-px h-6 bg-border mx-1 self-center" />

            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive("heading", { level: 1 })} title="Heading 1">
              <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} title="Heading 2">
              <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive("heading", { level: 3 })} title="Heading 3">
              <Heading3 className="h-4 w-4" />
            </ToolbarButton>

            <div className="w-px h-6 bg-border mx-1 self-center" />

            <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive("codeBlock")} title="Code Block">
              <Code className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={setLink} isActive={editor.isActive("link")} title="Add Link">
              <LinkIcon className="h-4 w-4" />
            </ToolbarButton>
          </BubbleMenu>
        )}

        {/* Fixed toolbar */}
        <div className="flex-shrink-0 flex flex-wrap gap-1 p-2 border-b border-border bg-background">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic">
            <Italic className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-1 self-center" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive("heading", { level: 1 })} title="Heading 1">
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} title="Heading 2">
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive("heading", { level: 3 })} title="Heading 3">
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-1 self-center" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet List">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Numbered List">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-1 self-center" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive("codeBlock")} title="Code Block">
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={setLink} isActive={editor.isActive("link")} title="Add Link">
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={onInsertMedia} title="Insert Media">
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => setEmbedModalOpen(true)} title="Insert Embed">
            <Play className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-1 self-center" />

          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Scrollable editor body */}
        <div className="flex-1 overflow-y-auto">
          <EditorContent editor={editor} />
        </div>

        <EmbedModal open={embedModalOpen} onOpenChange={setEmbedModalOpen} onInsert={handleInsertEmbed} />
      </div>
    );
  },
);

RichTextEditor.displayName = "RichTextEditor";
