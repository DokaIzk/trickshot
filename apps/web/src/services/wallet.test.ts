import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCeloChainId,
  assertCeloSepoliaChainId,
  CELO_SEPOLIA_CHAIN_ID,
  finalizeLoginSession,
  WrongNetworkError,
} from "./wallet.js";

describe("Celo Sepolia wallet guard", () => {
  it("accepts the locked Alpha chain", () => {
    assert.doesNotThrow(() => assertCeloSepoliaChainId(CELO_SEPOLIA_CHAIN_ID));
    assert.doesNotThrow(() => assertCeloSepoliaChainId(BigInt(CELO_SEPOLIA_CHAIN_ID)));
    assert.doesNotThrow(() => assertCeloChainId(CELO_SEPOLIA_CHAIN_ID));
  });

  it("rejects a different chain with a typed error", () => {
    assert.throws(
      () => assertCeloSepoliaChainId(42220),
      (error: unknown) => {
        assert.ok(error instanceof WrongNetworkError);
        assert.equal(error.chainId, 42220);
        return true;
      },
    );
    assert.throws(() => assertCeloChainId(1), WrongNetworkError);
  });
});

describe("finalizeLoginSession", () => {
  const session = { userId: "user-1" };

  it("keeps the Magic session when the Celo RPC check succeeds", async () => {
    const result = await finalizeLoginSession(session, {
      ensureNetwork: async () => undefined,
      signOut: async () => {
        throw new Error("should not sign out");
      },
    });
    assert.equal(result, session);
  });

  it("does not sign out when Magic iframe RPC fails after email login", async () => {
    let signedOut = false;
    const warn = console.warn;
    console.warn = () => undefined;
    try {
      const result = await finalizeLoginSession(session, {
        ensureNetwork: async () => {
          throw new Error(
            "An internal error was received.\n\nDetails: Magic RPC Error: [-32603] Failed to fetch\nVersion: viem@2.55.10",
          );
        },
        signOut: async () => {
          signedOut = true;
        },
      });
      assert.equal(result, session);
      assert.equal(signedOut, false);
    } finally {
      console.warn = warn;
    }
  });

  it("signs out when the observed chain is not the locked Celo network", async () => {
    let signedOut = false;
    await assert.rejects(
      () =>
        finalizeLoginSession(session, {
          ensureNetwork: async () => {
            throw new WrongNetworkError(1);
          },
          signOut: async () => {
            signedOut = true;
          },
        }),
      WrongNetworkError,
    );
    assert.equal(signedOut, true);
  });
});
