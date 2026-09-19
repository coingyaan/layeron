import "dotenv/config";
import { createPublicClient, http, parseAbiItem, getAddress } from "viem";
import { q, pool } from "./db.js";
import { gmEvent, xpEvent } from "./abi.js";

/**
 * Chain-agnostic indexer: point it at any enabled chain's RPC + GM/Reputation addresses.
 * Backfills from a start block then follows the head. Idempotent (PK on chain_id,tx,log).
 * Rebuildable: DELETE the rows + reset cursor and re-run.
 */
const RPC = process.env.INDEXER_RPC_URL!;
const GM = getAddress(process.env.INDEXER_GM_ADDRESS!);
const REP = getAddress(process.env.INDEXER_REPUTATION_ADDRESS!);
const START = BigInt(process.env.INDEXER_START_BLOCK || "0");
const CHAIN_ID = BigInt(process.env.INDEXER_CHAIN_ID || "0");

const client = createPublicClient({ transport: http(RPC) });

async function cursor(): Promise<bigint> {
  const r = await q("SELECT last_block FROM indexer_cursor WHERE chain_id=$1", [CHAIN_ID.toString()]);
  return r.rows[0] ? BigInt(r.rows[0].last_block) : START;
}
async function setCursor(b: bigint) {
  await q("INSERT INTO indexer_cursor(chain_id,last_block) VALUES($1,$2) ON CONFLICT (chain_id) DO UPDATE SET last_block=$2",
    [CHAIN_ID.toString(), b.toString()]);
}

async function handleRange(from: bigint, to: bigint) {
  const [gms, xps] = await Promise.all([
    client.getLogs({ address: GM, event: gmEvent as any, fromBlock: from, toBlock: to }),
    client.getLogs({ address: REP, event: xpEvent as any, fromBlock: from, toBlock: to }),
  ]);
  for (const l of gms) {
    const a = getAddress(l.args.user as string);
    const block = await client.getBlock({ blockNumber: l.blockNumber! });
    await q(`INSERT INTO gms(chain_id,tx_hash,log_index,address,utc_day,fee,xp_awarded,block_number,ts)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,to_timestamp($9)) ON CONFLICT DO NOTHING`,
      [CHAIN_ID.toString(), l.transactionHash, l.logIndex, a, Number(l.args.utcDay),
       (l.args.fee as bigint).toString(), (l.args.xpAwarded as bigint).toString(), Number(l.blockNumber),
       Number(block.timestamp)]);
    await q(`INSERT INTO users(address,total_gms) VALUES($1,1)
             ON CONFLICT (address) DO UPDATE SET total_gms=users.total_gms+1, updated_at=now()`, [a]);
  }
  for (const l of xps) {
    const a = getAddress(l.args.user as string);
    await q(`INSERT INTO users(address,xp,streak,longest_streak,last_xp_day)
             VALUES($1,$2,$3,$4,$5)
             ON CONFLICT (address) DO UPDATE SET xp=users.xp+$2, streak=$3, longest_streak=$4, last_xp_day=$5, updated_at=now()`,
      [a, (l.args.amount as bigint).toString(), Number(l.args.streak), Number(l.args.longestStreak), Number(l.args.utcDay)]);
  }
}

async function main() {
  let from = await cursor();
  const head = await client.getBlockNumber();
  const STEP = 5_000n;
  for (let b = from; b <= head; b += STEP) {
    const to = b + STEP - 1n > head ? head : b + STEP - 1n;
    await handleRange(b, to); await setCursor(to);
    console.log(`indexed ${b}..${to}`);
  }
  // follow head
  client.watchBlockNumber({
    onBlockNumber: async (bn) => {
      const last = await cursor();
      if (bn > last) { await handleRange(last + 1n, bn); await setCursor(bn); }
    },
  });
  console.log("indexer live from block", head.toString());
}
main().catch((e) => { console.error(e); pool.end(); process.exit(1); });
