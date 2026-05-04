import {
  IconBold,
  IconClearFormatting,
  IconCode,
  IconHighlight,
  IconItalic,
  IconLink,
  IconLinkOff,
  IconList,
  IconListNumbers,
  IconStrikethrough,
  IconSubscript,
  IconSuperscript,
  IconUnderline,
  IconPhoto,
} from "@tabler/icons-react";
import { Editor } from "@tiptap/react";
import { RichTextEditorControl } from "./RichTextEditor";
import { supabase } from "@/logic/supabase";
import { useNotifications } from "@/components/Notification";
import { memo, useCallback, useState, useRef } from "react";

interface ControlProps {
  editor: Editor | null;
}

export const BoldControl = memo(function BoldControl({ editor }: ControlProps) {
  return (
    <RichTextEditorControl
      onClick={() => editor?.chain().focus().toggleBold().run()}
      active={editor?.isActive("bold")}
      disabled={!editor?.can().chain().focus().toggleBold().run()}
      title="Bold (Ctrl+B)"
    >
      <IconBold />
    </RichTextEditorControl>
  );
});

export const ItalicControl = memo(function ItalicControl({
  editor,
}: ControlProps) {
  return (
    <RichTextEditorControl
      onClick={() => editor?.chain().focus().toggleItalic().run()}
      active={editor?.isActive("italic")}
      disabled={!editor?.can().chain().focus().toggleItalic().run()}
      title="Italic (Ctrl+I)"
    >
      <IconItalic />
    </RichTextEditorControl>
  );
});

export const UnderlineControl = memo(function UnderlineControl({
  editor,
}: ControlProps) {
  return (
    <RichTextEditorControl
      onClick={() => editor?.chain().focus().toggleUnderline().run()}
      active={editor?.isActive("underline")}
      disabled={!editor?.can().chain().focus().toggleUnderline().run()}
      title="Underline (Ctrl+U)"
    >
      <IconUnderline />
    </RichTextEditorControl>
  );
});

export const StrikethroughControl = memo(function StrikethroughControl({
  editor,
}: ControlProps) {
  return (
    <RichTextEditorControl
      onClick={() => editor?.chain().focus().toggleStrike().run()}
      active={editor?.isActive("strike")}
      disabled={!editor?.can().chain().focus().toggleStrike().run()}
      title="Strikethrough"
    >
      <IconStrikethrough />
    </RichTextEditorControl>
  );
});

export const HighlightControl = memo(function HighlightControl({
  editor,
}: ControlProps) {
  return (
    <RichTextEditorControl
      onClick={() => editor?.chain().focus().toggleHighlight().run()}
      active={editor?.isActive("highlight")}
      disabled={!editor?.can().chain().focus().toggleHighlight().run()}
      title="Highlight"
    >
      <IconHighlight />
    </RichTextEditorControl>
  );
});

export const CodeControl = memo(function CodeControl({ editor }: ControlProps) {
  return (
    <RichTextEditorControl
      onClick={() => editor?.chain().focus().toggleCode().run()}
      active={editor?.isActive("code")}
      disabled={!editor?.can().chain().focus().toggleCode().run()}
      title="Code"
    >
      <IconCode />
    </RichTextEditorControl>
  );
});

export const SubscriptControl = memo(function SubscriptControl({
  editor,
}: ControlProps) {
  return (
    <RichTextEditorControl
      onClick={() => editor?.chain().focus().toggleSubscript().run()}
      active={editor?.isActive("subscript")}
      disabled={!editor?.can().chain().focus().toggleSubscript().run()}
      title="Subscript"
    >
      <IconSubscript />
    </RichTextEditorControl>
  );
});

export const SuperscriptControl = memo(function SuperscriptControl({
  editor,
}: ControlProps) {
  return (
    <RichTextEditorControl
      onClick={() => editor?.chain().focus().toggleSuperscript().run()}
      active={editor?.isActive("superscript")}
      disabled={!editor?.can().chain().focus().toggleSuperscript().run()}
      title="Superscript"
    >
      <IconSuperscript />
    </RichTextEditorControl>
  );
});

export const ClearFormattingControl = memo(function ClearFormattingControl({
  editor,
}: ControlProps) {
  return (
    <RichTextEditorControl
      onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
      title="Clear formatting"
    >
      <IconClearFormatting />
    </RichTextEditorControl>
  );
});

export const BulletListControl = memo(function BulletListControl({
  editor,
}: ControlProps) {
  return (
    <RichTextEditorControl
      onClick={() => editor?.chain().focus().toggleBulletList().run()}
      active={editor?.isActive("bulletList")}
      title="Bullet list"
    >
      <IconList />
    </RichTextEditorControl>
  );
});

export const OrderedListControl = memo(function OrderedListControl({
  editor,
}: ControlProps) {
  return (
    <RichTextEditorControl
      onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      active={editor?.isActive("orderedList")}
      title="Numbered list"
    >
      <IconListNumbers />
    </RichTextEditorControl>
  );
});

export const LinkControl = memo(function LinkControl({ editor }: ControlProps) {
  const setLink = useCallback(() => {
    const previousUrl = editor?.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) {
      return;
    }

    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      ?.chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  return (
    <RichTextEditorControl
      onClick={setLink}
      active={editor?.isActive("link")}
      title="Add link"
    >
      <IconLink />
    </RichTextEditorControl>
  );
});

export const UnlinkControl = memo(function UnlinkControl({
  editor,
}: ControlProps) {
  return (
    <RichTextEditorControl
      onClick={() => editor?.chain().focus().unsetLink().run()}
      disabled={!editor?.isActive("link")}
      title="Remove link"
    >
      <IconLinkOff />
    </RichTextEditorControl>
  );
});

export const MediaUploadControl = memo(function MediaUploadControl({
  editor,
}: ControlProps) {
  const { showNotification } = useNotifications();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    showNotification({ title: "Uploading...", message: `Uploading ${file.name}`, type: "info" });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) throw new Error("Must be logged in to upload media.");

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${sessionData.session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('skola-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('skola-media')
        .getPublicUrl(filePath);

      if (file.type.startsWith('image/')) {
        editor?.chain().focus().setImage({ src: publicUrl }).run();
      } else {
        editor?.chain().focus().setLink({ href: publicUrl }).insertContent(file.name).run();
      }

      showNotification({ title: "Upload Success", message: "Media inserted.", type: "success" });
    } catch (err: any) {
      showNotification({ title: "Upload Failed", message: err.message, type: "error" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: "none" }} 
        onChange={handleUpload}
        accept="image/*,video/*,audio/*"
      />
      <RichTextEditorControl
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        title="Upload Media"
      >
        <IconPhoto />
      </RichTextEditorControl>
    </>
  );
});
