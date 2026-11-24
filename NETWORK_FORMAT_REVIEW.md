# Network/address mismatch control — 24 November 2026

Parentc1c5eabe21ae5a1918f8e5a14c929c32cc7331dd. Research form now checks known selected-network address format before sending an indexed-market lookup. Solana base58 with known EVM network (or0x address with Solana) produces an actionable network-selection message and aria-invalid=true. A subsequent valid lookup resets the invalid state. All-networks/unknown-indexed-network searches retain existing generic multichain format support. This does NOT verify address existence, contract identity, safety or unsupported-chain compatibility.

66Node tests PASS, including known-EVM/Solana/all/unknown formats. Responsive browser assertions check zero NEW lookup requests for mismatch, explicit error/invalid state, then valid Solana recovery with invalid state cleared across existing10viewports/sixroutes. No production provider call or deployment is part of this UI test. Local Chromium binary absent; exact-head browser CI required before PASS claim.

Implemented during bot CI wait; bot409f33ab connects genuine fresh scanner to strict block-auth and real research rejection, still NOT READY for trading. Radar current research/runtime contract unchanged; PostgreSQL freeze preserved. No copied third-party project design/branding/new module, sensitive clipboard read, paid use or deployment.
