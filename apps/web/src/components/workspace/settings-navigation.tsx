import { Select } from "@base-ui/react/select";
import {
  IconBuildingStore,
  IconUsers,
  IconTags,
  IconCreditCard,
  IconShieldCheck,
  IconKey,
  IconUserCircle,
  IconChevronDown,
  IconCheck,
} from "@tabler/icons-react";
import type { SettingsNavigationProps } from "./types/settings.type";

export function SettingsNavigation({
  value,
  onChange,
  disabled,
  hasBusiness,
  canManage,
  canWrite,
  hasAccess,
}: SettingsNavigationProps) {
  const groups = [
    {
      label: "Business",
      items: [
        {
          value: "profile",
          label: "Business profile",
          icon: IconBuildingStore,
          visible: hasBusiness,
        },
        { value: "staff", label: "Staff & permissions", icon: IconUsers, visible: hasBusiness },
        { value: "categories", label: "Expense categories", icon: IconTags, visible: hasBusiness },
        {
          value: "payments",
          label: "Payment settings",
          icon: IconCreditCard,
          visible: hasBusiness && canManage,
        },
        {
          value: "verification",
          label: "Verify payment",
          icon: IconShieldCheck,
          visible: hasBusiness && canWrite,
        },
        {
          value: "access",
          label: "Business access",
          icon: IconKey,
          visible: hasBusiness && hasAccess,
        },
      ].filter((item) => item.visible),
    },
    {
      label: "Personal",
      items: [{ value: "account", label: "Your account & invitations", icon: IconUserCircle }],
    },
  ].filter((group) => group.items.length);
  const selected = groups.flatMap((group) => group.items).find((item) => item.value === value);
  const SelectedIcon = selected?.icon ?? IconBuildingStore;
  return (
    <div className="workspace-card settings-navigation">
      <label id="settings-menu-label" htmlFor="settings-section">
        Settings menu
      </label>
      <Select.Root
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
        disabled={disabled}
      >
        <Select.Trigger
          id="settings-section"
          aria-labelledby="settings-menu-label"
          className="settings-menu-trigger"
        >
          <SelectedIcon size={19} aria-hidden="true" />
          <Select.Value>{selected?.label}</Select.Value>
          <Select.Icon className="settings-menu-chevron">
            <IconChevronDown size={17} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            sideOffset={8}
            align="start"
            alignItemWithTrigger={false}
            className="settings-menu-positioner"
          >
            <Select.Popup className="settings-menu-popup">
              <Select.List>
                {groups.map((group) => (
                  <Select.Group key={group.label}>
                    <Select.GroupLabel className="settings-menu-group">
                      {group.label}
                    </Select.GroupLabel>
                    {group.items.map((item) => (
                      <Select.Item
                        key={item.value}
                        value={item.value}
                        className="settings-menu-item"
                      >
                        <item.icon size={18} aria-hidden="true" />
                        <Select.ItemText>{item.label}</Select.ItemText>
                        <Select.ItemIndicator className="settings-menu-check">
                          <IconCheck size={17} />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Group>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
