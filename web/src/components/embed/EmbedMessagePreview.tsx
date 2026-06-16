'use client';

import { discordMarkdownToHtml } from '@/lib/discord-markdown';
import type { EmbedMessage } from '@/lib/embed-types';
import { colorIntToHex } from '@/lib/embed-types';
import {
  type ActionRowComponent,
  type MessageButton,
  type MessageComponent,
  isComponentsV2,
} from '@/lib/embed-components';
import './embed-preview.css';

interface Props {
  message: EmbedMessage;
  username: string;
  avatarUrl?: string | null;
}

const BUTTON_CLASS: Record<number, string> = {
  1: 'discord-button-primary',
  2: 'discord-button-secondary',
  3: 'discord-button-success',
  4: 'discord-button-destructive',
  5: 'discord-button-secondary',
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function parseTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatDate(date);
}

function PreviewButton({ btn }: { btn: MessageButton }) {
  const cls = `discord-button discord-button-hoverable ${BUTTON_CLASS[btn.style] ?? 'discord-button-secondary'}${btn.disabled ? ' discord-button-disabled' : ''}`;
  const inner = (
    <>
      {btn.emoji?.name && <span className="discord-button-emoji">{btn.emoji.name}</span>}
      <span>{btn.label}</span>
    </>
  );
  if (btn.style === 5 && btn.url) {
    return (
      <a className={cls} href={btn.url} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function PreviewComponents({ components, v2 }: { components: MessageComponent[]; v2: boolean }) {
  return (
    <>
      {components.map((comp) => {
        if (comp.type === 1) {
          const row = comp as ActionRowComponent;
          return (
            <div key={row.id} className="discord-action-row">
              {row.components.map((child) =>
                child.type === 2 ? (
                  <PreviewButton key={child.id} btn={child} />
                ) : (
                  <div key={child.id} className="discord-select-menu-preview">
                    <span>{child.placeholder || '셀렉트 메뉴'}</span>
                    <span className="discord-select-chevron">▾</span>
                  </div>
                )
              )}
            </div>
          );
        }
        if (!v2) return null;
        if (comp.type === 10) {
          return (
            <div
              key={comp.id}
              className="discord-v2-text"
              dangerouslySetInnerHTML={{ __html: discordMarkdownToHtml(comp.content) }}
            />
          );
        }
        if (comp.type === 9) {
          return (
            <div key={comp.id} className="discord-v2-section">
              <div className="discord-v2-section-text">
                {comp.components.map((t) => (
                  <div
                    key={t.id}
                    dangerouslySetInnerHTML={{ __html: discordMarkdownToHtml(t.content) }}
                  />
                ))}
              </div>
              {comp.accessory.type === 11 && comp.accessory.media.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={comp.accessory.media.url} alt="" className="discord-v2-section-thumb" />
              )}
              {comp.accessory.type === 2 && <PreviewButton btn={comp.accessory} />}
            </div>
          );
        }
        if (comp.type === 12) {
          return (
            <div key={comp.id} className="discord-v2-gallery">
              {comp.items.filter((i) => i.media.url).map((item) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={item.id} src={item.media.url} alt="" className="discord-v2-gallery-img" />
              ))}
            </div>
          );
        }
        if (comp.type === 14) {
          return (
            <div key={comp.id} className={`discord-v2-separator${comp.divider === false ? ' no-divider' : ''}`} />
          );
        }
        if (comp.type === 17) {
          return (
            <div
              key={comp.id}
              className="discord-v2-container"
              style={{ borderLeftColor: comp.accent_color ? colorIntToHex(comp.accent_color) : '#5865f2' }}
            >
              <PreviewComponents components={comp.components as MessageComponent[]} v2 />
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

export function EmbedMessagePreview({ message, username, avatarUrl }: Props) {
  const now = formatTime(new Date());
  const defaultAvatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
  const v2 = isComponentsV2(message.flags);

  if (v2 && message.components.length > 0) {
    return (
      <div className="discord-messages">
        <div className="discord-message">
          <div className="discord-message-inner">
            <div className="discord-author-avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl || defaultAvatar} alt="" />
            </div>
            <div className="discord-message-content">
              <span className="discord-author-info">
                <span className="discord-author-username">{username}</span>
                <span className="discord-application-tag">Bot</span>
              </span>
              <span className="discord-message-timestamp">오늘 {now}</span>
              <div className="discord-v2-message">
                <PreviewComponents components={message.components} v2 />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="discord-messages">
      <div className="discord-message">
        <div className="discord-message-inner">
          <div className="discord-author-avatar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl || defaultAvatar} alt="" />
          </div>
          <div className="discord-message-content">
            <span className="discord-author-info">
              <span className="discord-author-username">{username}</span>
              <span className="discord-application-tag">Bot</span>
            </span>
            <span className="discord-message-timestamp">오늘 {now}</span>

            {message.content.trim() && (
              <div className="discord-message-body">
                <div
                  dangerouslySetInnerHTML={{
                    __html: discordMarkdownToHtml(message.content),
                  }}
                />
              </div>
            )}

            {message.embeds.map((embed) => {
              let inlineIndex = 0;
              const hexColor = colorIntToHex(embed.color);
              let timestampLabel = '';
              if (embed.timestamp) {
                timestampLabel = parseTimestamp(embed.timestamp);
              }

              return (
                <div key={embed.id} className="discord-embed">
                  <div className="discord-left-border" style={{ backgroundColor: hexColor }} />
                  <div className="discord-embed-wrapper">
                    <div className="discord-embed-grid">
                      {embed.thumbnail?.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={embed.thumbnail.url}
                          alt=""
                          className="discord-embed-thumbnail"
                        />
                      )}

                      {embed.author?.name && (
                        <div className="discord-embed-author">
                          {embed.author.icon_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={embed.author.icon_url} alt="" className="discord-author-image" />
                          )}
                          {embed.author.url ? (
                            <a href={embed.author.url}>{embed.author.name}</a>
                          ) : (
                            embed.author.name
                          )}
                        </div>
                      )}

                      {embed.title && (
                        <div className="discord-embed-title">
                          {embed.url ? (
                            <a
                              href={embed.url}
                              dangerouslySetInnerHTML={{
                                __html: discordMarkdownToHtml(embed.title),
                              }}
                            />
                          ) : (
                            <span
                              dangerouslySetInnerHTML={{
                                __html: discordMarkdownToHtml(embed.title),
                              }}
                            />
                          )}
                        </div>
                      )}

                      {embed.description && (
                        <div
                          className="discord-embed-description"
                          dangerouslySetInnerHTML={{
                            __html: discordMarkdownToHtml(embed.description),
                          }}
                        />
                      )}

                      {embed.fields.length > 0 && (
                        <div className="discord-embed-fields">
                          {embed.fields.map((field) => {
                            const inlineClass = field.inline
                              ? ` discord-embed-inline-field discord-embed-inline-field-${(inlineIndex++ % 3) + 1}`
                              : '';
                            return (
                              <div key={field.id} className={`discord-embed-field${inlineClass}`}>
                                <div
                                  className="discord-field-title"
                                  dangerouslySetInnerHTML={{
                                    __html: discordMarkdownToHtml(field.name),
                                  }}
                                />
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: discordMarkdownToHtml(field.value),
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {embed.image?.url && (
                        <div className="discord-embed-media">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={embed.image.url} alt="" className="discord-embed-image" />
                        </div>
                      )}

                      {(embed.footer?.text || timestampLabel) && (
                        <div className="discord-embed-footer">
                          {embed.footer?.icon_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={embed.footer.icon_url} alt="" className="discord-footer-image" />
                          )}
                          {embed.footer?.text && <span>{embed.footer.text}</span>}
                          {timestampLabel && (
                            <span className="discord-embed-timestamp">{timestampLabel}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <PreviewComponents components={message.components} v2={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
