import { MongoClient } from "mongodb";
import type {
  ConnectionConfig,
  QueryResult,
  DatabaseSchema,
  TableInfo,
  ColumnInfo,
} from "../../schemas.js";
import type { DatabaseDriver } from "./index.js";

type MongoConfig = Extract<ConnectionConfig, { type: "mongodb" }>;

function buildConnectionUrl(config: MongoConfig): string {
  if (config.user && config.password) {
    const creds = `${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}`;
    const authSource = config.authSource ? `?authSource=${config.authSource}` : "";
    return `mongodb://${creds}@${config.host}:${config.port}/${config.database}${authSource}`;
  }
  return `mongodb://${config.host}:${config.port}/${config.database}`;
}

interface MongoQueryInput {
  collection: string;
  operation:
    | "find"
    | "aggregate"
    | "insertOne"
    | "insertMany"
    | "updateOne"
    | "updateMany"
    | "deleteOne"
    | "deleteMany"
    | "countDocuments"
    | "distinct";
  filter?: Record<string, unknown>;
  projection?: Record<string, unknown>;
  sort?: Record<string, unknown>;
  limit?: number;
  skip?: number;
  pipeline?: unknown[];
  document?: Record<string, unknown>;
  documents?: Record<string, unknown>[];
  update?: Record<string, unknown>;
  field?: string;
}

export function createMongoDriver(config: MongoConfig): DatabaseDriver {
  let client: MongoClient | null = null;

  return {
    async connect() {
      const url = buildConnectionUrl(config);
      client = new MongoClient(url, {
        tls: config.ssl,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
    },

    async disconnect() {
      if (client) {
        await client.close();
        client = null;
      }
    },

    async query(jsonInput: string): Promise<QueryResult> {
      if (!client) await this.connect();

      let cmd: MongoQueryInput;
      try {
        cmd = JSON.parse(jsonInput) as MongoQueryInput;
      } catch {
        throw new Error("Invalid MongoDB query: must be valid JSON");
      }

      const db = client!.db(config.database);
      const coll = db.collection(cmd.collection);
      const start = Date.now();

      let rows: Record<string, unknown>[] = [];
      let affected_rows: number | undefined;

      switch (cmd.operation) {
        case "find": {
          const cursor = coll.find(cmd.filter ?? {}, {
            projection: cmd.projection,
            sort: cmd.sort as Record<string, 1 | -1> | undefined,
            limit: cmd.limit ?? 100,
            skip: cmd.skip,
          });
          const docs = await cursor.toArray();
          rows = docs.map((d) => ({ ...d, _id: d._id?.toString() }));
          break;
        }
        case "aggregate": {
          const docs = await coll.aggregate(cmd.pipeline as Record<string, unknown>[] ?? []).toArray();
          rows = docs.map((d) => ({ ...d, _id: d._id?.toString() }));
          break;
        }
        case "insertOne": {
          const result = await coll.insertOne(cmd.document ?? {});
          affected_rows = result.acknowledged ? 1 : 0;
          rows = [{ insertedId: result.insertedId.toString() }];
          break;
        }
        case "insertMany": {
          const result = await coll.insertMany(cmd.documents ?? []);
          affected_rows = result.insertedCount;
          rows = [{ insertedCount: result.insertedCount }];
          break;
        }
        case "updateOne": {
          const result = await coll.updateOne(cmd.filter ?? {}, cmd.update ?? {});
          affected_rows = result.modifiedCount;
          rows = [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
          break;
        }
        case "updateMany": {
          const result = await coll.updateMany(cmd.filter ?? {}, cmd.update ?? {});
          affected_rows = result.modifiedCount;
          rows = [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
          break;
        }
        case "deleteOne": {
          const result = await coll.deleteOne(cmd.filter ?? {});
          affected_rows = result.deletedCount;
          rows = [{ deletedCount: result.deletedCount }];
          break;
        }
        case "deleteMany": {
          const result = await coll.deleteMany(cmd.filter ?? {});
          affected_rows = result.deletedCount;
          rows = [{ deletedCount: result.deletedCount }];
          break;
        }
        case "countDocuments": {
          const count = await coll.countDocuments(cmd.filter ?? {});
          rows = [{ count }];
          break;
        }
        case "distinct": {
          const values = await coll.distinct(cmd.field ?? "", cmd.filter ?? {});
          rows = values.map((v) => ({ value: v }));
          break;
        }
        default:
          throw new Error(`Unsupported operation: ${(cmd as MongoQueryInput).operation}`);
      }

      const executionTime = Date.now() - start;
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      return {
        columns,
        rows,
        row_count: rows.length,
        execution_time_ms: executionTime,
        affected_rows,
      };
    },

    async testConnection() {
      try {
        await this.connect();
        await client!.db(config.database).command({ ping: 1 });
        await this.disconnect();
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Unknown error",
        };
      }
    },

    async introspect(): Promise<DatabaseSchema> {
      if (!client) await this.connect();

      const db = client!.db(config.database);
      const collectionInfos = await db.listCollections().toArray();

      const tables: TableInfo[] = [];

      for (const info of collectionInfos) {
        const coll = db.collection(info.name);

        // Sample up to 10 docs to infer field types
        const samples = await coll.find({}).limit(10).toArray();

        const fieldMap: Map<string, Set<string>> = new Map();

        for (const doc of samples) {
          for (const [key, val] of Object.entries(doc)) {
            if (!fieldMap.has(key)) fieldMap.set(key, new Set());
            const t = val === null ? "null" : typeof val;
            fieldMap.get(key)!.add(t);
          }
        }

        const columns: ColumnInfo[] = Array.from(fieldMap.entries()).map(
          ([name, types]) => ({
            name,
            type: Array.from(types).join(" | "),
            nullable: types.has("null") || types.has("undefined"),
            default_value: null,
            is_primary_key: name === "_id",
          })
        );

        // Ensure _id is listed first
        columns.sort((a, b) =>
          a.is_primary_key ? -1 : b.is_primary_key ? 1 : 0
        );

        const row_count = await coll.countDocuments();

        tables.push({
          name: info.name,
          columns,
          foreign_keys: [],
          row_count,
        });
      }

      return {
        tables,
        database_name: config.database,
        database_type: "mongodb",
      };
    },
  };
}
