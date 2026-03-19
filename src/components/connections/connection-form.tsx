import { useState } from "react";
import { Loader2, Check, X, FolderOpen, Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type DbType = "postgresql" | "mysql" | "sqlite" | "mongodb";

interface FormValues {
  name: string;
  type: DbType;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  filepath: string;
}

interface ConnectionFormProps {
  onSave: (connection: any) => void;
  initialValues?: Partial<FormValues>;
}

const DEFAULT_PORTS: Record<DbType, string> = {
  postgresql: "5432",
  mysql: "3306",
  sqlite: "",
  mongodb: "27017",
};

const DB_TYPES: { value: DbType; label: string; color: string; description: string }[] = [
  { value: "postgresql", label: "PostgreSQL", color: "border-blue-500 text-blue-400 bg-blue-500/10", description: "Advanced open-source DB" },
  { value: "mysql", label: "MySQL", color: "border-orange-500 text-orange-400 bg-orange-500/10", description: "Popular relational DB" },
  { value: "mongodb", label: "MongoDB", color: "border-emerald-500 text-emerald-400 bg-emerald-500/10", description: "Document database" },
  { value: "sqlite", label: "SQLite", color: "border-green-500 text-green-400 bg-green-500/10", description: "Embedded file-based DB" },
];

type TestStatus = "idle" | "testing" | "success" | "error";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-400 mt-1">{message}</p>;
}

export function ConnectionForm({ onSave, initialValues }: ConnectionFormProps) {
  const [values, setValues] = useState<FormValues>({
    name: initialValues?.name ?? "",
    type: initialValues?.type ?? "postgresql",
    host: initialValues?.host ?? "localhost",
    port: initialValues?.port ?? DEFAULT_PORTS[initialValues?.type ?? "postgresql"],
    database: initialValues?.database ?? "",
    user: initialValues?.user ?? "",
    password: initialValues?.password ?? "",
    ssl: initialValues?.ssl ?? false,
    filepath: initialValues?.filepath ?? "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState<string>("");
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleTypeChange(type: DbType) {
    setValues((prev) => ({
      ...prev,
      type,
      port: DEFAULT_PORTS[type],
    }));
    setTestStatus("idle");
    setTestMessage("");
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormValues, string>> = {};

    if (!values.name.trim()) next.name = "Connection name is required.";

    if (values.type === "sqlite") {
      if (!values.filepath.trim()) next.filepath = "File path is required.";
    } else {
      if (!values.host.trim()) next.host = "Host is required.";
      if (!values.port.trim()) next.port = "Port is required.";
      else if (isNaN(Number(values.port))) next.port = "Port must be a number.";
      if (!values.database.trim()) next.database = "Database name is required.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleTest() {
    if (!validate()) return;

    setTestStatus("testing");
    setTestMessage("");

    try {
      // Create connection first
      const createRes = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.message ?? "Failed to save connection for testing.");
      }

      const created = await createRes.json();
      const connId: string = created.id ?? created.connection?.id;

      // Test it
      const testRes = await fetch(`/api/connections/${connId}/test`, { method: "POST" });
      const testData = await testRes.json().catch(() => ({}));

      if (testRes.ok && testData.success !== false) {
        setTestStatus("success");
        setTestMessage(testData.message ?? "Connection successful.");
      } else {
        setTestStatus("error");
        setTestMessage(testData.message ?? testData.error ?? "Connection failed.");
      }
    } catch (err: any) {
      setTestStatus("error");
      setTestMessage(err.message ?? "Unexpected error.");
    }
  }

  function buildPayload() {
    if (values.type === "sqlite") {
      return {
        name: values.name,
        config: { type: values.type, path: values.filepath },
      };
    }
    if (values.type === "mongodb") {
      return {
        name: values.name,
        config: {
          type: values.type,
          host: values.host,
          port: Number(values.port),
          database: values.database,
          user: values.user,
          password: values.password,
          authSource: "admin",
          ssl: values.ssl,
        },
      };
    }
    return {
      name: values.name,
      config: {
        type: values.type,
        host: values.host,
        port: Number(values.port),
        database: values.database,
        user: values.user,
        password: values.password,
        ssl: values.ssl,
      },
    };
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Failed to save.");
      }
      const data = await res.json();
      onSave(data);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, name: err.message }));
    } finally {
      setSaving(false);
    }
  }

  const isNetworkType = values.type !== "sqlite";

  return (
    <div className="space-y-6">
      {/* DB type selector */}
      <div>
        <Label className="text-xs text-zinc-400 uppercase tracking-wider mb-3 block">
          Database Type
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {DB_TYPES.map((db) => (
            <button
              key={db.value}
              type="button"
              onClick={() => handleTypeChange(db.value)}
              className={cn(
                "rounded-lg border px-3 py-3 text-left transition-all duration-150",
                values.type === db.value
                  ? db.color
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800"
              )}
            >
              <p className="font-semibold text-sm">{db.label}</p>
              <p className="text-[11px] opacity-70 mt-0.5">{db.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <Label htmlFor="conn-name" className="text-sm text-zinc-300">
          Connection Name
        </Label>
        <Input
          id="conn-name"
          placeholder="e.g. Production DB"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          className="mt-1.5 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-500"
        />
        <FieldError message={errors.name} />
      </div>

      {/* Network DB fields */}
      {isNetworkType && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label htmlFor="conn-host" className="text-sm text-zinc-300">Host</Label>
              <Input
                id="conn-host"
                placeholder="localhost"
                value={values.host}
                onChange={(e) => set("host", e.target.value)}
                className="mt-1.5 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-500"
              />
              <FieldError message={errors.host} />
            </div>
            <div>
              <Label htmlFor="conn-port" className="text-sm text-zinc-300">Port</Label>
              <Input
                id="conn-port"
                placeholder={DEFAULT_PORTS[values.type]}
                value={values.port}
                onChange={(e) => set("port", e.target.value)}
                className="mt-1.5 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-500"
              />
              <FieldError message={errors.port} />
            </div>
          </div>

          <div>
            <Label htmlFor="conn-database" className="text-sm text-zinc-300">Database</Label>
            <Input
              id="conn-database"
              placeholder="my_database"
              value={values.database}
              onChange={(e) => set("database", e.target.value)}
              className="mt-1.5 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-500"
            />
            <FieldError message={errors.database} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="conn-user" className="text-sm text-zinc-300">Username</Label>
              <Input
                id="conn-user"
                placeholder="postgres"
                value={values.user}
                onChange={(e) => set("user", e.target.value)}
                className="mt-1.5 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-500"
              />
              <FieldError message={errors.user} />
            </div>
            <div>
              <Label htmlFor="conn-password" className="text-sm text-zinc-300">Password</Label>
              <Input
                id="conn-password"
                type="password"
                placeholder="••••••••"
                value={values.password}
                onChange={(e) => set("password", e.target.value)}
                className="mt-1.5 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-500"
              />
              <FieldError message={errors.password} />
            </div>
          </div>

          {/* SSL toggle */}
          <button
            type="button"
            onClick={() => set("ssl", !values.ssl)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm transition-all w-full",
              values.ssl
                ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
            )}
          >
            {values.ssl ? (
              <Shield className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ShieldOff className="h-4 w-4 flex-shrink-0" />
            )}
            <span className="font-medium">SSL {values.ssl ? "Enabled" : "Disabled"}</span>
            <span className="ml-auto text-xs opacity-60">
              {values.ssl ? "Encrypted connection" : "Click to enable SSL"}
            </span>
          </button>
        </>
      )}

      {/* SQLite path */}
      {!isNetworkType && (
        <div>
          <Label htmlFor="conn-filepath" className="text-sm text-zinc-300">Database File Path</Label>
          <div className="relative mt-1.5">
            <Input
              id="conn-filepath"
              placeholder="/Users/you/data/mydb.sqlite"
              value={values.filepath}
              onChange={(e) => set("filepath", e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-500 pr-10"
            />
            <FolderOpen className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">
            Use an absolute path. The file must exist and be readable by this app.
          </p>
          <FieldError message={errors.filepath} />
        </div>
      )}

      {/* Test result */}
      {testStatus !== "idle" && (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm",
            testStatus === "testing" && "border-zinc-700 bg-zinc-800/60 text-zinc-400",
            testStatus === "success" && "border-green-500/30 bg-green-500/10 text-green-400",
            testStatus === "error" && "border-red-500/30 bg-red-500/10 text-red-400"
          )}
        >
          {testStatus === "testing" && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 mt-0.5" />}
          {testStatus === "success" && <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />}
          {testStatus === "error" && <X className="h-4 w-4 flex-shrink-0 mt-0.5" />}
          <span>
            {testStatus === "testing" ? "Testing connection…" : testMessage}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={handleTest}
          disabled={testStatus === "testing" || saving}
        >
          {testStatus === "testing" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Test Connection
        </Button>
        <Button
          type="button"
          className="flex-1 bg-zinc-100 text-zinc-900 hover:bg-white"
          onClick={handleSave}
          disabled={saving || testStatus === "testing"}
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save Connection
        </Button>
      </div>
    </div>
  );
}
