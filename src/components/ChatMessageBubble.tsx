import { Fragment, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import type { AppTheme } from '../theme/tokens';
import type { ChatAttachment, ChatMessage } from '../types';

type MarkdownBlock =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'heading'; level: number; content: string }
  | { type: 'bullet'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'code'; content: string; language?: string }
  | { type: 'image'; uri: string; alt?: string };

type InlineToken =
  | { type: 'text'; content: string }
  | { type: 'strong'; content: string }
  | { type: 'emphasis'; content: string }
  | { type: 'inlineCode'; content: string }
  | { type: 'link'; content: string; href: string };

function isImageUrl(value: string) {
  return /^https?:\/\/\S+\.(png|jpe?g|gif|webp|bmp|svg)(\?\S*)?$/i.test(value);
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const codeMatch = trimmed.match(/^```([\w-]+)?$/);

    if (codeMatch) {
      const language = codeMatch[1];
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({
        type: 'code',
        content: codeLines.join('\n'),
        language,
      });
      continue;
    }

    const markdownImageMatch = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);

    if (markdownImageMatch) {
      blocks.push({
        type: 'image',
        alt: markdownImageMatch[1],
        uri: markdownImageMatch[2],
      });
      index += 1;
      continue;
    }

    if (isImageUrl(trimmed)) {
      blocks.push({
        type: 'image',
        uri: trimmed,
      });
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);

    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];

      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }

      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ''));
        index += 1;
      }

      blocks.push({ type: 'bullet', items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
        index += 1;
      }

      blocks.push({ type: 'numbered', items });
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const current = lines[index] ?? '';
      const currentTrimmed = current.trim();

      if (
        !currentTrimmed ||
        /^```/.test(currentTrimmed) ||
        /^(#{1,6})\s+/.test(currentTrimmed) ||
        /^>\s?/.test(currentTrimmed) ||
        /^[-*]\s+/.test(currentTrimmed) ||
        /^\d+\.\s+/.test(currentTrimmed)
      ) {
        break;
      }

      paragraphLines.push(current);
      index += 1;
    }

    blocks.push({ type: 'paragraph', lines: paragraphLines });
  }

  return blocks;
}

function parseInlineTokens(content: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let index = 0;

  while (index < content.length) {
    const markdownLinkMatch = content
      .slice(index)
      .match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);

    if (markdownLinkMatch) {
      tokens.push({
        type: 'link',
        content: markdownLinkMatch[1],
        href: markdownLinkMatch[2],
      });
      index += markdownLinkMatch[0].length;
      continue;
    }

    const plainUrlMatch = content.slice(index).match(/^(https?:\/\/[^\s]+)/);

    if (plainUrlMatch) {
      tokens.push({
        type: 'link',
        content: plainUrlMatch[1],
        href: plainUrlMatch[1],
      });
      index += plainUrlMatch[1].length;
      continue;
    }

    const inlineCodeStart = content.indexOf('`', index);
    const strongStart = content.indexOf('**', index);
    const emphasisStart = content.indexOf('*', index);
    const markdownLinkStart = content.indexOf('[', index);
    const plainUrlStart = content.slice(index).search(/https?:\/\//);
    const normalizedPlainUrlStart = plainUrlStart >= 0 ? index + plainUrlStart : -1;
    const candidates = [
      inlineCodeStart,
      strongStart,
      emphasisStart,
      markdownLinkStart,
      normalizedPlainUrlStart,
    ].filter((value) => value >= 0);
    const nextStart = candidates.length > 0 ? Math.min(...candidates) : -1;

    if (nextStart === -1) {
      tokens.push({ type: 'text', content: content.slice(index) });
      break;
    }

    if (nextStart > index) {
      tokens.push({ type: 'text', content: content.slice(index, nextStart) });
    }

    if (nextStart === inlineCodeStart) {
      const end = content.indexOf('`', nextStart + 1);

      if (end > nextStart + 1) {
        tokens.push({
          type: 'inlineCode',
          content: content.slice(nextStart + 1, end),
        });
        index = end + 1;
        continue;
      }
    }

    if (nextStart === strongStart) {
      const end = content.indexOf('**', nextStart + 2);

      if (end > nextStart + 2) {
        tokens.push({
          type: 'strong',
          content: content.slice(nextStart + 2, end),
        });
        index = end + 2;
        continue;
      }
    }

    if (nextStart === emphasisStart) {
      const end = content.indexOf('*', nextStart + 1);

      if (end > nextStart + 1) {
        tokens.push({
          type: 'emphasis',
          content: content.slice(nextStart + 1, end),
        });
        index = end + 1;
        continue;
      }
    }

    tokens.push({ type: 'text', content: content.slice(nextStart, nextStart + 1) });
    index = nextStart + 1;
  }

  return tokens;
}

function renderInline(
  content: string,
  color: string,
  onOpenLink: (href: string) => void | Promise<void>,
  openedLinks: string[],
) {
  return parseInlineTokens(content).map((token, index) => {
    if (token.type === 'strong') {
      return (
        <Text key={`strong-${index}`} style={[styles.content, styles.strongText, { color }]}>
          {token.content}
        </Text>
      );
    }

    if (token.type === 'emphasis') {
      return (
        <Text key={`em-${index}`} style={[styles.content, styles.emphasisText, { color }]}>
          {token.content}
        </Text>
      );
    }

    if (token.type === 'inlineCode') {
      return (
        <Text
          key={`code-${index}`}
          style={[styles.content, styles.inlineCode, { color }]}
        >
          {token.content}
        </Text>
      );
    }

    if (token.type === 'link') {
      const linkColor = openedLinks.includes(token.href) ? '#2563EB' : color;
      return (
        <Text
          key={`link-${index}`}
          style={[styles.content, styles.linkText, { color: linkColor }]}
          onPress={() => void onOpenLink(token.href)}
        >
          {token.content}
        </Text>
      );
    }

    return (
      <Fragment key={`text-${index}`}>
        {token.content}
      </Fragment>
    );
  });
}

function renderMarkdownBlocks(
  blocks: MarkdownBlock[],
  color: string,
  theme: AppTheme,
  onOpenLink: (href: string) => void | Promise<void>,
  openedLinks: string[],
) {
  return blocks.map((block, index) => {
    if (block.type === 'heading') {
      return (
        <Text
          key={`heading-${index}`}
          style={[
            styles.content,
            styles.blockSpacing,
            block.level <= 2 ? styles.headingLg : styles.headingSm,
            { color },
          ]}
        >
          {renderInline(block.content, color, onOpenLink, openedLinks)}
        </Text>
      );
    }

    if (block.type === 'paragraph') {
      return (
        <Text key={`paragraph-${index}`} style={[styles.content, styles.blockSpacing, { color }]}>
          {renderInline(block.lines.join('\n'), color, onOpenLink, openedLinks)}
        </Text>
      );
    }

    if (block.type === 'blockquote') {
      return (
        <View
          key={`quote-${index}`}
          style={[
            styles.quoteBlock,
            styles.blockSpacing,
            { borderLeftColor: theme.colors.primary },
          ]}
        >
          <Text style={[styles.content, styles.quoteText, { color }]}>
            {renderInline(block.lines.join('\n'), color, onOpenLink, openedLinks)}
          </Text>
        </View>
      );
    }

    if (block.type === 'bullet' || block.type === 'numbered') {
      return (
        <View key={`list-${index}`} style={styles.blockSpacing}>
          {block.items.map((item, itemIndex) => (
            <View key={`item-${itemIndex}`} style={styles.listRow}>
              <Text style={[styles.content, styles.listMarker, { color }]}>
                {block.type === 'bullet' ? '\u2022' : `${itemIndex + 1}.`}
              </Text>
              <Text style={[styles.content, styles.listContent, { color }]}>
                {renderInline(item, color, onOpenLink, openedLinks)}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    if (block.type === 'image') {
      return (
        <Pressable
          key={`image-${index}`}
          onPress={() => void onOpenLink(block.uri)}
          style={styles.blockSpacing}
        >
          <Image
            source={{ uri: block.uri }}
            style={[styles.messageImage, { borderColor: theme.colors.border }]}
            resizeMode="cover"
          />
          {block.alt ? (
            <Text style={[styles.imageCaption, { color: theme.colors.textMuted }]}>
              {block.alt}
            </Text>
          ) : null}
        </Pressable>
      );
    }

    return (
      <View
        key={`codeblock-${index}`}
        style={[
          styles.codeBlock,
          styles.blockSpacing,
          {
            backgroundColor: theme.colors.surfaceElevated,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {block.language ? (
          <Text style={[styles.codeLanguage, { color: theme.colors.textMuted }]}>
            {block.language}
          </Text>
        ) : null}
        <Text style={[styles.codeText, { color }]}>{block.content || ' '}</Text>
      </View>
    );
  });
}

function formatMessageTime(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getElapsedSeconds(createdAt: string) {
  const createdAtMs = new Date(createdAt).getTime();

  if (Number.isNaN(createdAtMs)) {
    return 1;
  }

  return Math.max(1, Math.floor((Date.now() - createdAtMs) / 1000));
}

function shouldAttachAuthHeaders(uri: string | undefined, token: string | undefined) {
  return Boolean(token && uri && /^https?:\/\//i.test(uri));
}

export function ChatMessageBubble({
  theme,
  message,
  imageAuthToken,
  onPreviewImage,
}: {
  theme: AppTheme;
  message: ChatMessage;
  imageAuthToken?: string;
  onPreviewImage?: (image: { uri: string; title?: string }) => void;
}) {
  const isUser = message.role === 'user';
  const textColor = isUser ? '#FFFFFF' : theme.colors.text;
  const hasStreamingPlaceholder = !isUser && message.streaming && !message.content.trim();
  const content = message.content || '';
  const markdownBlocks = parseMarkdownBlocks(content);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [openedLinks, setOpenedLinks] = useState<string[]>([]);
  const [failedPreviewIds, setFailedPreviewIds] = useState<string[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => getElapsedSeconds(message.createdAt));
  const timestamp = useMemo(() => formatMessageTime(message.createdAt), [message.createdAt]);
  const isSpeakable = !isUser && !message.streaming && Boolean(content.trim());

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setCopied(false);
    }, 1600);

    return () => clearTimeout(timeoutId);
  }, [copied]);

  useEffect(() => {
    if (!hasStreamingPlaceholder) {
      return;
    }

    setElapsedSeconds(getElapsedSeconds(message.createdAt));

    const intervalId = setInterval(() => {
      setElapsedSeconds(getElapsedSeconds(message.createdAt));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [hasStreamingPlaceholder, message.createdAt]);

  async function handleCopy() {
    if (!content.trim()) {
      return;
    }

    await Clipboard.setStringAsync(content);
    setCopied(true);
  }

  async function handleSpeak() {
    if (!content.trim()) {
      return;
    }

    if (isSpeaking || (await Speech.isSpeakingAsync())) {
      await Speech.stop();
      setIsSpeaking(false);
      return;
    }

    const nextContent = content.slice(0, Speech.maxSpeechInputLength);

    Speech.speak(nextContent, {
      rate: 0.96,
      pitch: 1,
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }

  async function handleOpenLink(href: string) {
    const supported = await Linking.canOpenURL(href);

    if (!supported) {
      return;
    }

    await Linking.openURL(href);
    setOpenedLinks((current) => (current.includes(href) ? current : [...current, href]));
  }

  function handlePreviewAttachment(attachment: ChatAttachment) {
    const imageUri =
      attachment.previewUri && !failedPreviewIds.includes(attachment.id)
        ? attachment.previewUri
        : attachment.uri;

    if (onPreviewImage) {
      onPreviewImage({
        uri: imageUri,
        title: attachment.fileName,
      });
      return;
    }

    void handleOpenLink(attachment.uri);
  }

  return (
    <View
      style={[
        styles.row,
        {
          alignItems: isUser ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          {
            backgroundColor: isUser ? theme.colors.primary : theme.colors.surface,
            borderColor: isUser ? theme.colors.primary : theme.colors.border,
          },
        ]}
      >
        {message.attachments?.map((attachment) => (
          <Pressable
            key={attachment.id}
            onPress={() => handlePreviewAttachment(attachment)}
            style={styles.blockSpacing}
          >
            {(() => {
              const usePreview = Boolean(
                attachment.previewUri && !failedPreviewIds.includes(attachment.id),
              );
              const imageUri = usePreview ? attachment.previewUri : attachment.uri;

              return (
            <Image
              source={{
                uri: imageUri,
                headers: shouldAttachAuthHeaders(imageUri, imageAuthToken)
                  ? {
                      Authorization: `Bearer ${imageAuthToken}`,
                    }
                  : undefined,
              }}
              onError={() => {
                if (attachment.previewUri) {
                  setFailedPreviewIds((current) =>
                    current.includes(attachment.id) ? current : [...current, attachment.id],
                  );
                }
              }}
              style={[
                styles.messageImage,
                {
                  borderColor: theme.colors.border,
                },
              ]}
              resizeMode="cover"
            />
              );
            })()}
          </Pressable>
        ))}
        {hasStreamingPlaceholder ? (
          <View style={styles.thinkingWrap}>
            <Text style={[styles.content, styles.thinkingText, { color: '#ebebeb' }]}>
              {`Thinking est ${elapsedSeconds}s`}
            </Text>
            <Text style={[styles.thinkingMeta, { color: theme.colors.textMuted }]}>
              {`${elapsedSeconds}s elapsed`}
            </Text>
          </View>
        ) : (
          renderMarkdownBlocks(markdownBlocks, textColor, theme, handleOpenLink, openedLinks)
        )}
      </View>
      <View style={[styles.footerRow, { alignSelf: isUser ? 'flex-end' : 'flex-start' }]}>
        {timestamp ? (
          <Text style={[styles.timestampText, { color: theme.colors.textMuted }]}>{timestamp}</Text>
        ) : null}
        {isSpeakable ? (
          <Pressable
            onPress={() => void handleSpeak()}
            hitSlop={8}
            style={styles.copyButton}
          >
            <Text
              style={[
                styles.copyButtonText,
                { color: isSpeaking ? theme.colors.primary : theme.colors.textMuted },
              ]}
            >
              {isSpeaking ? 'Stop' : 'Speak'}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => void handleCopy()}
          hitSlop={8}
          style={styles.copyButton}
        >
          <Text style={[styles.copyButtonText, { color: copied ? theme.colors.primary : theme.colors.textMuted }]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    marginBottom: 14,
  },
  bubble: {
    maxWidth: '82%',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  userBubble: {
    borderRadius: 24,
    borderBottomRightRadius: 8,
  },
  assistantBubble: {
    borderRadius: 24,
    borderBottomLeftRadius: 8,
  },
  thinkingWrap: {
    gap: 2,
  },
  thinkingText: {
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  thinkingMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  content: {
    fontSize: 14,
    lineHeight: 22,
  },
  blockSpacing: {
    marginBottom: 10,
  },
  headingLg: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '800',
  },
  headingSm: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
  },
  strongText: {
    fontWeight: '800',
  },
  emphasisText: {
    fontStyle: 'italic',
  },
  inlineCode: {
    fontFamily: 'monospace',
    fontSize: 15,
  },
  linkText: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  quoteBlock: {
    borderLeftWidth: 3,
    paddingLeft: 12,
  },
  quoteText: {
    opacity: 0.92,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  listMarker: {
    width: 24,
    fontWeight: '700',
  },
  listContent: {
    flex: 1,
  },
  codeBlock: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  codeLanguage: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 21,
  },
  messageImage: {
    width: 240,
    maxWidth: '100%',
    height: 180,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#00000010',
  },
  imageCaption: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    paddingHorizontal: 6,
  },
  timestampText: {
    fontSize: 12,
    lineHeight: 16,
  },
  copyButton: {
    paddingVertical: 2,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
