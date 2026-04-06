import type { NamespaceOption } from "../hooks/useNamespace";

interface Props {
  namespace: string;
  namespaces: NamespaceOption[];
  onNamespaceChange: (ns: string) => void;
  isCompact: boolean;
}

export function NamespaceSelector({ namespace, namespaces, onNamespaceChange, isCompact }: Props) {
  if (isCompact) {
    // In compact mode, show a minimal indicator button
    const active = namespaces.find((n) => n.id === namespace);
    const initials = active?.label.split(" ").map((w) => w[0]).join("").slice(0, 2) ?? "NS";
    return (
      <div className="namespace-selector namespace-selector--compact" title={active?.label ?? namespace}>
        <span className="namespace-selector__initials">{initials}</span>
      </div>
    );
  }

  return (
    <div className="namespace-selector" role="group" aria-label="Select namespace">
      <label className="namespace-selector__label" htmlFor="namespace-select">
        Namespace
      </label>
      <select
        id="namespace-select"
        className="namespace-selector__select"
        value={namespace}
        onChange={(e) => onNamespaceChange(e.target.value)}
        aria-label="Select agent namespace"
      >
        {namespaces.map((ns) => (
          <option key={ns.id} value={ns.id}>
            {ns.label}
          </option>
        ))}
      </select>
    </div>
  );
}
