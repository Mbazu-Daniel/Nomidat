import {
  IconBrandTelegram,
  IconBrandWhatsapp,
  IconArrowUpRight,
  IconLink,
  IconCheck,
} from "@tabler/icons-react";
import type { ChannelProviderCardsProps } from "./types";
const providers = [
  {
    id: "telegram",
    name: "Telegram",
    icon: IconBrandTelegram,
    description:
      "Your business, one message away. Record sales, check stock and open your dashboard without leaving Telegram.",
    features: ["Text, voice & photos", "Mini App dashboard", "Invoice delivery"],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: IconBrandWhatsapp,
    description:
      "Keep business moving in the chat you already use. Send a voice note, track expenses and get answers on the go.",
    features: ["Text, voice & photos", "Sales & expenses", "Invoice delivery"],
  },
];

export function ChannelProviderCards({
  identities,
  loading,
  busy,
  onConnect,
}: ChannelProviderCardsProps) {
  return (
    <div className="channels-grid">
      {providers.map((item) => {
        const count = identities.filter((row) => row.provider === item.id).length;
        return (
          <section className="workspace-card channel-provider" key={item.id}>
            <div className="channel-provider-top">
              <span className={`channel-brand ${item.id}`}>
                <item.icon size={29} stroke={1.5} />
              </span>
              <span className={`channel-status ${count ? "connected" : ""}`}>
                {loading ? "Checking…" : count ? `${count} linked` : "Not connected"}
              </span>
            </div>
            <h2>{item.name}</h2>
            <p className="channel-description">{item.description}</p>
            <ul className="channel-features">
              {item.features.map((feature) => (
                <li key={feature}>
                  <IconCheck size={14} />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              className="workspace-primary"
              disabled={busy || loading}
              onClick={() => void onConnect(item.id)}
            >
              <IconLink size={17} />
              {count ? "Link another account" : `Connect ${item.name}`}
              <IconArrowUpRight size={17} />
            </button>
          </section>
        );
      })}
    </div>
  );
}
