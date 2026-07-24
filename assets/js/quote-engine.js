/* ===========================================================
   Anytime Anywhere Mobile Notary Services LLC
   QUOTE ENGINE

   Pure calculation. No DOM access, no storage, no network.
   Every rate is read from PRICING_CONFIG. Nothing is hard
   coded here, so editing the config changes every result.

   ---------------------------------------------------------
   APPROVAL GATE
   ---------------------------------------------------------
   A rate only produces a client ready number when its status
   is "published_approved" or "approved_internal", or when you
   have typed a custom amount for that specific appointment.

     published_approved / approved_internal
         used normally. An approved $0.00 is an intentional
         zero and does NOT block.
     proposed
         used, but the whole quote drops to INTERNAL ESTIMATE
         and no client facing output is allowed.
     custom_required
         contributes $0.00 and the whole quote becomes
         FINAL TOTAL UNAVAILABLE until you supply an amount.

   An item is only checked when it is actually selected, so an
   unused option never blocks a quote.

   calculateQuote(inputs, config) returns:
     {
       blocked, blockReason,          loan supervision hold
       completeness: "complete" | "internal_only" | "unavailable",
       clientReady:  true | false,
       missing:  [ {path, label, source, where} ],
       proposed: [ {path, label, amount, where} ],
       groups, totals, warnings
     }
   =========================================================== */

(function (root) {
  "use strict";

  var PUB    = "published_approved";
  var APPR   = "approved_internal";
  var PROP   = "proposed";
  var CUSTOM = "custom_required";

  /* ---------- helpers ---------- */

  function num(v, fallback) {
    var n = parseFloat(v);
    if (isNaN(n) || !isFinite(n)) { return fallback === undefined ? 0 : fallback; }
    return n;
  }
  function count(v) {
    var n = Math.floor(num(v, 0));
    return n < 0 ? 0 : n;
  }
  function money(v) { return Math.round(num(v, 0) * 100) / 100; }
  function fmt(v) {
    var n = money(v);
    return (n < 0 ? "-" : "") + "$" + Math.abs(n).toFixed(2);
  }
  function dedupe(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      if (!seen[arr[i]]) { seen[arr[i]] = true; out.push(arr[i]); }
    }
    return out;
  }

  /* ---------- the approval gate ---------- */

  function Ctx(customRates) {
    this.missing = [];
    this.proposed = [];
    this.warnings = [];
    this.custom = customRates || {};
  }

  Ctx.prototype.hasCustom = function (path) {
    var v = this.custom[path];
    return v !== undefined && v !== null && v !== "" && !isNaN(parseFloat(v));
  };

  /* Read a rate through the approval gate.
     Call this ONLY when the item is genuinely selected. */
  Ctx.prototype.use = function (entry, path, where) {
    if (!entry || entry.enabled === false) { return 0; }

    if (this.hasCustom(path)) { return money(this.custom[path]); }

    var amt = money(entry.amount !== undefined ? entry.amount : entry.base);
    var st = entry.status;

    if (st === PUB || st === APPR) { return amt; }

    if (st === PROP) {
      this.proposed.push({ path: path, label: entry.label, amount: amt, where: where || "" });
      return amt;
    }

    /* custom_required, or any unrecognised status, blocks. */
    this.missing.push({
      path: path, label: entry.label,
      source: entry.source || "No approved amount",
      where: where || ""
    });
    return 0;
  };

  /* ---------- line collector ---------- */

  function Group(title) { this.title = title; this.lines = []; }
  Group.prototype.add = function (label, amount, detail) {
    var a = money(amount);
    if (a === 0 && !detail) { return; }
    this.lines.push({ label: label, detail: detail || "", amount: a });
  };
  Group.prototype.addAlways = function (label, amount, detail) {
    this.lines.push({ label: label, detail: detail || "", amount: money(amount) });
  };
  Group.prototype.sum = function () {
    var t = 0;
    for (var i = 0; i < this.lines.length; i++) { t += this.lines[i].amount; }
    return money(t);
  };
  Group.prototype.isEmpty = function () { return this.lines.length === 0; };

  function emptyTotals() {
    return { businessFees: 0, statutory: 0, passThrough: 0, government: 0, discounts: 0,
             subtotal: 0, tax: 0, cardAdjustment: 0, estimatedTotal: 0,
             deposit: 0, balanceDue: 0, minimumApplied: false };
  }

  function finish(ctx, extra) {
    var completeness = ctx.missing.length ? "unavailable"
                     : (ctx.proposed.length ? "internal_only" : "complete");
    var out = {
      blocked: false, blockReason: "",
      completeness: completeness,
      clientReady: completeness === "complete",
      missing: ctx.missing,
      proposed: ctx.proposed,
      warnings: dedupe(ctx.warnings),
      groups: [], totals: emptyTotals()
    };
    if (extra) { Object.keys(extra).forEach(function (k) { out[k] = extra[k]; }); }
    return out;
  }

  /* ===========================================================
     MAIN
     =========================================================== */

  function calculateQuote(inputs, config) {
    var i = inputs || {};
    var c = config;
    var ctx = new Ctx(i.customRates);
    var groups = [];

    var svcKey = i.service || "general_mobile";
    var svc = c.services[svcKey] || c.services.general_mobile;

    /* -------------------------------------------------------
       SAFEGUARD 1, loan signing supervision gate
       ------------------------------------------------------- */
    if (svc.loan) {
      var confirmed = i.loan && i.loan.attorneySupervisionConfirmed;
      var pending   = i.loan && i.loan.quotePending;
      if (!confirmed && !pending) {
        var held = finish(ctx);
        held.blocked = true;
        held.clientReady = false;
        held.blockReason = "Georgia is an attorney closing state. This calculator does not " +
          "authorize an independent real estate closing. Confirm attorney supervision before " +
          "accepting or performing a Georgia loan signing assignment. Select \"Attorney " +
          "supervision confirmed\" or \"Quote pending attorney supervision confirmation\" to continue.";
        return held;
      }
      if (pending && !confirmed) {
        ctx.warnings.push("QUOTE PENDING: attorney supervision is not yet confirmed. Do not accept " +
                          "or perform this assignment until it is confirmed in writing.");
      }
    }

    /* -------------------------------------------------------
       SAFEGUARD 2, the statutory first act policy must be set
       ------------------------------------------------------- */
    var firstActPolicy = c.rules.statutoryFirstActTreatment;
    if (firstActPolicy !== "included" && firstActPolicy !== "added") {
      ctx.missing.push({
        path: "rules.statutoryFirstActTreatment",
        label: "First $2 statutory notarial fee, treatment not chosen",
        source: "Policy setting, not a dollar amount",
        where: "Pricing Settings, Global rules",
        isPolicy: true
      });
    }

    /* =======================================================
       BASE RESOLUTION
       The service base, the timing minimum and the location
       minimum are all MINIMUM BASES. The highest one wins.
       They are never stacked on top of each other.
       ======================================================= */
    var timingKey = i.timing || "standard";
    var timing = c.timing[timingKey] || c.timing.standard;
    var locKey = i.locationType;
    var locEntry = (locKey && c.locations[locKey]) ? c.locations[locKey] : null;

    var baseEntry = svc;
    var basePath = "services." + svcKey;
    var aliasNote = "";

    if (svc.pricingMode === "use_general" && svc.aliasOf && c.services[svc.aliasOf]) {
      baseEntry = c.services[svc.aliasOf];
      basePath = "services." + svc.aliasOf;
      aliasNote = "Priced at the approved " + c.services[svc.aliasOf].label.toLowerCase() + " rate";
    } else if (svc.pricingMode === "custom") {
      baseEntry = { label: svc.label, base: 0, enabled: true,
                    status: CUSTOM, source: "Set to require a custom quote" };
    }

    var serviceBase = ctx.use(baseEntry, basePath, "Primary service");

    /* Collect every applicable minimum base. */
    var candidates = [{ amount: serviceBase, label: svc.label, kind: "service" }];

    if (svc.timingFloor && timing.enabled !== false &&
        timing.tierBase !== null && timing.tierBase !== undefined &&
        (timing.status === PUB || timing.status === APPR)) {
      candidates.push({ amount: money(timing.tierBase), label: timing.label, kind: "timing" });
    }
    if (locEntry && locEntry.enabled !== false &&
        locEntry.tierBase !== null && locEntry.tierBase !== undefined &&
        (locEntry.status === PUB || locEntry.status === APPR)) {
      candidates.push({ amount: money(locEntry.tierBase), label: locEntry.label, kind: "location" });
    }

    var winner = candidates[0];
    candidates.forEach(function (x) { if (x.amount > winner.amount) { winner = x; } });

    var effectiveBase = winner.amount;
    var baseLabel = svc.label;
    var baseDetail = aliasNote || "Starting price";
    var tierApplied = winner.kind !== "service";

    if (tierApplied) {
      baseLabel = svc.label + ", " + winner.label.toLowerCase() + " minimum";
      baseDetail = winner.label + " minimum base of " + fmt(effectiveBase) +
                   " replaces the " + fmt(serviceBase) + " base";
    }
    candidates.forEach(function (x) {
      if (x !== winner && x.amount > 0) {
        ctx.warnings.push("Duplicate charge prevented: the " + x.label.toLowerCase() +
                          " minimum of " + fmt(x.amount) + " was not added on top. The highest " +
                          "applicable minimum base of " + fmt(effectiveBase) + " was used instead.");
      }
    });

    /* =======================================================
       TRAVEL, one way mileage from your starting location
         excessMiles = max(0, oneWayMiles - includedMiles)
         fee         = excessMiles x perMileRate
       ======================================================= */
    var t = i.travel || {};
    var measureLabel = (t.measurement || c.travel.measurement) === "one_way" ? "one way" : "round trip";

    function computeTravel() {
      var out = { fee: 0, label: "", detail: "", longDistance: false, applied: false };

      if (t.overrideAmount !== undefined && t.overrideAmount !== null && t.overrideAmount !== "") {
        out.fee = money(t.overrideAmount);
        out.label = "Manual travel override";
        out.detail = t.overrideReason || "";
        out.applied = true;
        if (!t.overrideReason || !String(t.overrideReason).trim()) {
          ctx.missing.push({ path: "travel.overrideReason",
            label: "A reason is required for a manual travel override",
            source: "Enter a reason", where: "Travel section" });
        }
        return out;
      }

      if (t.mode === "miles") {
        var miles = Math.max(0, num(t.miles, 0));
        var incl = money(c.travel.includedMiles.amount);
        var perMile = ctx.use(c.travel.perMileRate, "travel.perMileRate", "Travel section");
        var excess = Math.max(0, miles - incl);
        out.fee = money(excess * perMile);
        out.applied = true;
        out.longDistance = miles > money(c.travel.longDistanceThreshold.amount);
        if (excess > 0) {
          out.label = "Excess mileage: " + excess.toFixed(1) + " one way miles beyond the included " +
                      incl + " at " + fmt(perMile);
          out.detail = miles.toFixed(1) + " one way miles from your starting location";
        } else {
          out.label = "Travel";
          out.detail = miles.toFixed(1) + " one way miles, within the included " + incl + " miles";
        }
        return out;
      }

      if (t.mode === "zone" && t.zone) {
        var zone = c.travel.zones[t.zone];
        if (zone) {
          out.fee = ctx.use(zone, "travel.zones." + t.zone, "Travel section");
          out.label = "Travel zone: " + zone.label;
          out.detail = "Distance measured " + measureLabel;
          out.applied = true;
          out.longDistance = (t.zone === "z50_plus");
        }
        return out;
      }

      if (t.mode === "custom") {
        var cta = money(t.customAmount);
        if (cta > 0) {
          out.fee = cta; out.label = "Custom travel fee";
          out.detail = t.customNote || "Entered for this appointment"; out.applied = true;
        } else {
          ctx.use(c.travel.zones.custom, "travel.zones.custom", "Travel section");
        }
      }
      return out;
    }

    var travelInfo = computeTravel();
    if (travelInfo.longDistance) {
      ctx.warnings.push(c.disclaimers.longDistance ||
        "Long-distance appointment. Confirm availability before accepting.");
    }

    var parkingTolls = money(t.parking) + money(t.tolls) + money(t.valet);

    /* =======================================================
       SAFEGUARD 3, cancellation, no show and return trip
       ======================================================= */
    if (i.cancellationOnly) {
      var cg = new Group("Cancellation, no show, or trip charge");
      var cEntry = i.cancellationType ? c.cancellation[i.cancellationType] : null;

      if (!cEntry) {
        ctx.missing.push({ path: "cancellation.none", label: "No cancellation reason selected",
                           source: "Select a reason", where: "Cancellation section" });
      } else {
        var mode = cEntry.mode || "flat";
        var cPath = "cancellation." + i.cancellationType;

        if (mode === "none") {
          cg.addAlways(cEntry.label, 0, "No charge under your policy");
        } else if (mode === "full_base") {
          cg.addAlways("Applicable appointment base: " + baseLabel, effectiveBase,
                       "Charged as a trip and appointment fee, not as a completed notarization");
          if (travelInfo.applied && travelInfo.fee !== 0) {
            cg.addAlways(travelInfo.label, travelInfo.fee, travelInfo.detail);
          }
          ctx.warnings.push("No notarial act fee was charged, because no notarial act was performed. " +
                            "This is a travel, appointment and convenience charge.");
        } else {
          cg.addAlways(cEntry.label, ctx.use(cEntry, cPath, "Cancellation section"));
          if (i.cancellationType === "return_trip" || i.cancellationType === "resign_client") {
            if (travelInfo.applied && travelInfo.fee !== 0) {
              cg.addAlways(travelInfo.label, travelInfo.fee, travelInfo.detail);
            }
          }
        }

        if (mode !== "none") {
          [["Parking", t.parking], ["Tolls", t.tolls], ["Valet", t.valet]].forEach(function (row) {
            if (money(row[1]) !== 0) {
              cg.addAlways(row[0], money(row[1]), "Already incurred, pass through");
            }
          });
        }
        groups.push(cg);
      }

      var cTotal = cg.sum();
      var cOut = finish(ctx, {
        groups: groups,
        totals: { businessFees: cTotal, statutory: 0, passThrough: 0, government: 0, discounts: 0,
                  subtotal: cTotal, tax: 0, cardAdjustment: 0, estimatedTotal: cTotal,
                  deposit: 0, balanceDue: cTotal, minimumApplied: false }
      });
      cOut.missing = cOut.missing.filter(function (m) { return !m.isPolicy; });
      cOut.completeness = cOut.missing.length ? "unavailable"
                        : (cOut.proposed.length ? "internal_only" : "complete");
      cOut.clientReady = cOut.completeness === "complete";
      return cOut;
    }

    /* =======================================================
       1. PRIMARY SERVICE
       ======================================================= */
    var gService = new Group("1. Primary service");
    gService.addAlways(baseLabel, effectiveBase, baseDetail);
    var customService = money(i.customServiceAmount);
    if (customService !== 0) {
      gService.add("Custom service amount", customService, i.customServiceLabel || "Entered manually");
    }
    groups.push(gService);

    /* =======================================================
       2. TRAVEL AND MILEAGE
       ======================================================= */
    var gTravel = new Group("2. Travel and mileage");
    if (travelInfo.applied) {
      gTravel.addAlways(travelInfo.label, travelInfo.fee, travelInfo.detail);
    }
    var stops = count(t.additionalStops);
    if (stops > 0) {
      gTravel.addAlways(stops + " additional stop" + (stops > 1 ? "s" : ""),
                        stops * ctx.use(c.travel.additionalStop, "travel.additionalStop", "Travel section"));
    }
    if (t.returnTrip) {
      gTravel.addAlways(c.travel.returnTrip.label,
                        ctx.use(c.travel.returnTrip, "travel.returnTrip", "Travel section"));
    }
    if (!gTravel.isEmpty()) { groups.push(gTravel); }


    /* =======================================================
       3. STATUTORY GEORGIA NOTARIAL FEE
       ======================================================= */
    var gStat = new Group("3. Statutory Georgia notarial fee");
    var cnt = i.counts || {};
    var acts = count(cnt.acts);
    var signers = count(cnt.signers);
    var documents = count(cnt.documents);

    var nonNotarial = ["i9", "apostille", "apostille_pickup", "apostille_courier",
                       "courier_only", "pickup_delivery", "witness_only", "custom_service"];
    var isNonNotarial = nonNotarial.indexOf(svcKey) !== -1;

    if (svcKey === "i9" && acts > 0) {
      ctx.warnings.push("An I-9 verification is not a notarization. Only count notarial acts here " +
                        "if a separate document genuinely requires one.");
    }
    if (documents > 0 && acts === 0 && !isNonNotarial && !svc.loan) {
      ctx.warnings.push("You entered documents but zero notarial acts. Documents, signers, " +
                        "signatures and notarial acts are counted separately. Confirm the act count.");
    }

    var statFee = ctx.use(c.rules.statutoryActFee, "rules.statutoryActFee", "Global rules");
    var includedActs = money(c.rules.includedActs.amount);
    var billableActs = acts;
    var statDetail = "State authorized fee, charged separately from travel and convenience fees";

    if (firstActPolicy === "included") {
      billableActs = Math.max(0, acts - includedActs);
      statDetail = "Policy: the first " + includedActs + " statutory act is inside the base price. " +
                   "Only acts beyond that are charged.";
    } else if (firstActPolicy === "added") {
      statDetail = "Policy: every statutory act is added to the base price, including the first.";
    }

    if (acts > 0 && statFee > 0 && billableActs > 0) {
      gStat.addAlways("Georgia notarial act fee: " + billableActs + " act" +
                      (billableActs > 1 ? "s" : "") + " at " + fmt(statFee),
                      billableActs * statFee, statDetail);
      groups.push(gStat);
    } else if (acts > 0 && firstActPolicy === "included" && billableActs === 0) {
      gStat.addAlways("Georgia notarial act fee", 0, statDetail);
      groups.push(gStat);
    }

    /* =======================================================
       4. DOCUMENTS, SIGNERS AND ACTS
       ======================================================= */
    var gQty = new Group("4. Documents, signers and acts");
    var extraActs = Math.max(0, acts - includedActs);
    if (extraActs > 0) {
      gQty.addAlways(extraActs + " additional notarial act" + (extraActs > 1 ? "s" : "") +
                     " beyond the " + includedActs + " included",
                     extraActs * ctx.use(c.quantities.additionalAct,
                                         "quantities.additionalAct", "Documents section"));
    }

    var extraSigners = Math.max(0, signers - 1);
    if (extraSigners > 0 && svcKey === "i9") {
      gQty.addAlways(extraSigners + " additional signer" + (extraSigners > 1 ? "s" : ""), 0,
                     "Not charged. I-9 employees are billed per employee below");
      ctx.warnings.push("Duplicate charge prevented: additional signers were not charged on this " +
                        "I-9 assignment because employees are billed per employee instead.");
      extraSigners = 0;
    }
    if (extraSigners > 0) {
      gQty.addAlways(extraSigners + " additional signer" + (extraSigners > 1 ? "s" : ""),
                     extraSigners * ctx.use(c.quantities.additionalSigner,
                                            "quantities.additionalSigner", "Documents section"));
    }

    var extraDocs = Math.max(0, documents - 1);
    if (extraDocs > 0) {
      var docRate = ctx.use(c.quantities.additionalDocument,
                            "quantities.additionalDocument", "Documents section");
      if (docRate > 0) {
        gQty.addAlways(extraDocs + " additional document" + (extraDocs > 1 ? "s" : ""),
                       extraDocs * docRate);
      }
    }
    if (!gQty.isEmpty()) { groups.push(gQty); }

    /* =======================================================
       5. LOCATION PREMIUM
       ======================================================= */
    var gLoc = new Group("5. Location premium");
    var facilityServices = ["hospital", "nursing_home", "assisted_living", "hospice", "rehab_facility"];
    var facilityLocations = ["hospital", "nursing_home", "assisted_living", "hospice",
                             "rehab", "senior_community"];

    if (locKey && locEntry) {
      var loc = locEntry;
      var locAmt = ctx.use(loc, "locations." + locKey, "Location section");
      if (facilityServices.indexOf(svcKey) !== -1 && facilityLocations.indexOf(locKey) !== -1 && locAmt > 0) {
        gLoc.addAlways("Location premium: " + loc.label, 0,
                       "Not charged. The facility rate is already in the base price");
        ctx.warnings.push("Duplicate charge prevented: the facility service base already covers the " +
                          loc.label.toLowerCase() + " premium, so it was not added again.");
      } else if (locAmt > 0) {
        gLoc.addAlways("Location premium: " + loc.label, locAmt);
      }
    }
    if (!gLoc.isEmpty()) { groups.push(gLoc); }

    /* =======================================================
       6. TIMING AND URGENCY
       ======================================================= */
    var gTime = new Group("6. Timing and urgency");

    /* A timing option with no tier and no approved premium still
       has to clear the gate when it is selected. */
    if (timingKey !== "standard") {
      /* A timing option with no minimum base of its own still has to
         clear the approval gate when it is selected. */
      if (timing.tierBase === null || timing.tierBase === undefined) {
        var tp = ctx.use(timing, "timing." + timingKey, "Timing section");
        if (tp > 0) { gTime.addAlways("Timing premium: " + timing.label, tp); }
      } else if (winner.kind === "timing") {
        gTime.addAlways("Timing: " + timing.label, 0,
                        "Already applied as the " + fmt(effectiveBase) + " minimum base");
      } else {
        gTime.addAlways("Timing: " + timing.label, 0,
                        "The " + fmt(effectiveBase) + " minimum base already exceeds the " +
                        timing.label.toLowerCase() + " minimum of " + fmt(timing.tierBase));
      }
    }

    /* Urgency premiums never stack. Only the highest applicable
       premium is charged, even if several could arguably apply. */
    var urgKey = i.urgency || "scheduled";
    var urgCandidates = [urgKey];
    if (Array.isArray(i.urgencyList) && i.urgencyList.length) { urgCandidates = i.urgencyList; }

    var bestUrg = null, bestUrgKey = null, bestUrgAmt = 0, suppressed = [];
    urgCandidates.forEach(function (k) {
      var e = c.urgency[k];
      if (!e || k === "scheduled" || e.enabled === false) { return; }
      var amt = money(e.amount);
      if (bestUrg === null || amt > bestUrgAmt) {
        if (bestUrg) { suppressed.push(bestUrg.label + " at " + fmt(bestUrgAmt)); }
        bestUrg = e; bestUrgKey = k; bestUrgAmt = amt;
      } else { suppressed.push(e.label + " at " + fmt(amt)); }
    });

    if (bestUrg) {
      gTime.addAlways("Urgency: " + bestUrg.label,
                      ctx.use(bestUrg, "urgency." + bestUrgKey, "Timing section"),
                      "Highest applicable urgency premium. Urgency premiums do not stack.");
      if (suppressed.length) {
        ctx.warnings.push("Duplicate charge prevented: only the highest urgency premium was charged. " +
                          "Not added: " + suppressed.join(", ") + ".");
      }
    }

    var customTiming = money(i.customTimingFee);
    if (customTiming !== 0) { gTime.add("Custom timing fee", customTiming); }
    if (!gTime.isEmpty()) { groups.push(gTime); }

    /* =======================================================
       7. PRINTING AND DOCUMENT HANDLING
       ======================================================= */
    var gPrint = new Group("7. Printing and document handling");
    var p = i.printing || {};
    var pr = c.printing;
    var printMode = p.mode || "none";
    var printPages = count(p.pages);

    if (printMode === "general" && printPages > 0) {
      var gIncl = money(pr.generalIncludedPages.amount);
      var gBase = ctx.use(pr.generalBase, "printing.generalBase", "Printing section");
      gPrint.addAlways("General printing, first " + gIncl + " pages", gBase,
                       printPages + " pages total");
      var gExtra = Math.max(0, printPages - gIncl);
      if (gExtra > 0) {
        var gOver = ctx.use(pr.generalOverPage, "printing.generalOverPage", "Printing section");
        gPrint.addAlways(gExtra + " page" + (gExtra > 1 ? "s" : "") + " over " + gIncl +
                         " at " + fmt(gOver), money(gExtra * gOver));
      }
    } else if ((printMode === "loan_one" || printMode === "loan_two") && printPages > 0) {
      var sets = printMode === "loan_two" ? 2 : 1;
      var lIncl = money(pr.loanIncludedPages.amount);
      var lEntry = sets === 2 ? pr.loanTwoSets : pr.loanOneSet;
      var lPath = sets === 2 ? "printing.loanTwoSets" : "printing.loanOneSet";
      var lBase = ctx.use(lEntry, lPath, "Printing section");
      gPrint.addAlways(lEntry.label, lBase,
                       printPages + " pages per set, " + sets + " set" + (sets > 1 ? "s" : ""));
      var lExtra = Math.max(0, printPages - lIncl);
      if (lExtra > 0) {
        var lOver = ctx.use(pr.loanOverPage, "printing.loanOverPage", "Printing section");
        gPrint.addAlways(lExtra + " page" + (lExtra > 1 ? "s" : "") + " beyond " + lIncl +
                         " per set, " + sets + " set" + (sets > 1 ? "s" : "") + " at " + fmt(lOver),
                         money(lExtra * lOver * sets));
      }
    }

    var scanPages = count(p.scanbackPages);
    if (scanPages > 0) {
      var thr = money(pr.scanbackThreshold.amount);
      var scEntry = scanPages > thr ? pr.scanbackOver : pr.scanbackUpTo;
      var scPath = scanPages > thr ? "printing.scanbackOver" : "printing.scanbackUpTo";
      gPrint.addAlways(scEntry.label, ctx.use(scEntry, scPath, "Printing section"),
                       scanPages + " scanback pages");
    }

    if (p.faxbacks) {
      gPrint.addAlways(pr.faxbacks.label, ctx.use(pr.faxbacks, "printing.faxbacks", "Printing section"));
    }

    [["shippingLabel", pr.shippingLabel, "shippingLabel"],
     ["carrierDropOff", pr.carrierDropOff, "carrierDropOff"],
     ["courierOnly", pr.courierOnly, "courierOnly"],
     ["emailDocs", pr.emailDocs, "emailDocs"],
     ["packaging", pr.packaging, "packaging"],
     ["docPickup", pr.docPickup, "docPickup"],
     ["docReturn", pr.docReturn, "docReturn"]].forEach(function (f) {
      if (p[f[0]]) {
        gPrint.addAlways(f[1].label, ctx.use(f[1], "printing." + f[2], "Printing section"));
      }
    });

    var courierStops = count(p.courierStops);
    if (courierStops > 0) {
      gPrint.addAlways(courierStops + " additional courier stop" + (courierStops > 1 ? "s" : ""),
                       courierStops * ctx.use(pr.courierStop, "printing.courierStop", "Printing section"));
    }
    if (money(p.customHandling) !== 0) {
      gPrint.add("Custom document handling", money(p.customHandling),
                 p.customHandlingNote || "Entered for this appointment");
    }
    if (!gPrint.isEmpty()) { groups.push(gPrint); }

    /* =======================================================
       8. WITNESS SERVICES
       ======================================================= */
    var gWit = new Group("8. Witness services");
    var w = i.witness || {};
    var witnessesNeeded = count(cnt.witnessesRequired);
    var witnessesByNotary = count(cnt.witnessesProvided);

    if (witnessesByNotary > witnessesNeeded && witnessesNeeded > 0) {
      ctx.warnings.push("You are providing more witnesses than the document requires. Confirm the count.");
    }
    if (w.coordination) {
      gWit.addAlways("Witness coordination fee",
                     ctx.use(c.witness.coordination, "witness.coordination", "Witness section"));
    }
    if (witnessesByNotary > 0) {
      gWit.addAlways(witnessesByNotary + " witness" + (witnessesByNotary > 1 ? "es" : "") +
                     " provided by the notary",
                     witnessesByNotary * ctx.use(c.witness.perWitness, "witness.perWitness", "Witness section"));
      ctx.warnings.push("Witness availability is not guaranteed until confirmed.");
    }
    if (money(w.custom) !== 0) {
      gWit.add("Custom witness charge", money(w.custom), "Entered for this appointment");
    }
    if (!gWit.isEmpty()) { groups.push(gWit); }

    /* =======================================================
       9. WAITING TIME
       ======================================================= */
    var gWait = new Group("9. Waiting time");
    var totalWait = count(i.waitingMinutes);
    var includedMin = money(c.rules.includedMinutes.amount);
    var extraMin = Math.max(0, totalWait - includedMin);

    if (totalWait > 0) {
      if (extraMin === 0) {
        gWait.addAlways("Waiting time", 0, totalWait + " minutes total, within the " +
                        includedMin + " minutes included in the appointment");
      } else {
        var per15 = ctx.use(c.waiting.per15, "waiting.per15", "Waiting section");
        var per30 = c.waiting.per30 && c.waiting.per30.enabled !== false &&
                    (c.waiting.per30.status === PUB || c.waiting.per30.status === APPR ||
                     ctx.hasCustom("waiting.per30"))
                  ? ctx.use(c.waiting.per30, "waiting.per30", "Waiting section") : 0;

        var waitCharge, waitDetail;
        if (per30 > 0) {
          var n30 = Math.floor(extraMin / 30);
          var rem = extraMin - (n30 * 30);
          var n15 = rem > 0 ? Math.ceil(rem / 15) : 0;
          waitCharge = (n30 * per30) + (n15 * per15);
          waitDetail = extraMin + " minutes past the " + includedMin + " included: " + n30 +
                       " x 30 minute block" + (n30 === 1 ? "" : "s") +
                       (n15 > 0 ? " plus " + n15 + " x 15 minute block" + (n15 === 1 ? "" : "s") : "");
        } else {
          var b15 = Math.ceil(extraMin / 15);
          waitCharge = b15 * per15;
          waitDetail = extraMin + " minutes past the " + includedMin + " included: " + b15 +
                       " x 15 minute block" + (b15 === 1 ? "" : "s");
        }
        gWait.addAlways("Additional waiting time", waitCharge, waitDetail);
      }
    }
    if (money(i.customDelayFee) !== 0) {
      gWait.add("Custom delay fee", money(i.customDelayFee), i.waitingReason || "");
    }
    if (!gWait.isEmpty()) { groups.push(gWait); }

    /* =======================================================
       10. PASS THROUGH, parking, tolls, valet
       ======================================================= */
    var gPass = new Group("10. Parking, tolls and pass through costs");
    var passThrough = 0;
    [["Parking", t.parking], ["Tolls", t.tolls], ["Valet", t.valet]].forEach(function (row) {
      if (money(row[1]) !== 0) {
        gPass.addAlways(row[0], money(row[1]), "Pass through cost");
        passThrough += money(row[1]);
      }
    });
    if (!gPass.isEmpty()) { groups.push(gPass); }

    /* =======================================================
       11a. I-9
       ======================================================= */
    var gI9 = new Group("11. I-9 verification");
    if (svcKey === "i9") {
      var n9 = i.i9 || {};
      var employees = Math.max(1, count(n9.employees) || 1);
      var extraEmployees = employees - 1;

      if (n9.businessRate) {
        var br = ctx.use(c.i9.businessRate, "i9.businessRate", "I-9 section");
        if (br > 0) {
          gI9.addAlways("Custom business account rate replaces the per employee rate",
                        br - effectiveBase, "Net adjustment against the " + fmt(effectiveBase) + " base");
          ctx.warnings.push("A custom business account rate replaced the standard I-9 price.");
        }
      }
      if (extraEmployees > 0) {
        gI9.addAlways(extraEmployees + " additional employee" + (extraEmployees > 1 ? "s" : "") +
                      " at the same location",
                      extraEmployees * ctx.use(c.i9.additionalSameSite,
                                               "i9.additionalSameSite", "I-9 section"));
      }
      var sepSites = count(n9.separateLocations);
      if (sepSites > 0) {
        gI9.addAlways(sepSites + " separate employee location" + (sepSites > 1 ? "s" : ""),
                      sepSites * ctx.use(c.i9.separateLocation, "i9.separateLocation", "I-9 section"));
      }
      [["portal", c.i9.portalHandling, "portalHandling"], ["upload", c.i9.documentUpload, "documentUpload"],
       ["printing", c.i9.printing, "printing"], ["rush", c.i9.rush, "rush"]].forEach(function (f) {
        if (n9[f[0]]) { gI9.addAlways(f[1].label, ctx.use(f[1], "i9." + f[2], "I-9 section")); }
      });
      ctx.warnings.push("I-9 service: you act as the employer's designated authorized representative. " +
                        "This is not a notarization unless a separate document requires a notarial act.");
    }
    if (!gI9.isEmpty()) { groups.push(gI9); }

    /* =======================================================
       11b. LOAN SIGNING ADDITIONS
       ======================================================= */
    var gLoan = new Group("11. Loan signing additions");
    if (svc.loan) {
      var ln = i.loan || {};
      [["additionalSigners", c.loan.additionalSigner, "additionalSigner"],
       ["additionalProperties", c.loan.additionalProperty, "additionalProperty"]].forEach(function (e) {
        var qn = count(ln[e[0]]);
        if (qn > 0) {
          gLoan.addAlways(qn + " x " + e[1].label,
                          qn * ctx.use(e[1], "loan." + e[2], "Loan signing section"));
        }
      });
      [["sellerBuyerCombo", c.loan.sellerBuyerCombo, "sellerBuyerCombo"],
       ["trustOrPoa", c.loan.trustOrPoa, "trustOrPoa"],
       ["faxbacks", c.loan.faxbacks, "faxbacks"],
       ["resignReturn", c.loan.resignReturn, "resignReturn"]].forEach(function (f) {
        if (ln[f[0]]) { gLoan.addAlways(f[1].label, ctx.use(f[1], "loan." + f[2], "Loan signing section")); }
      });
      if (ln.noPrint) {
        var np = ctx.use(c.loan.noPrintDiscount, "loan.noPrintDiscount", "Loan signing section");
        if (np !== 0) { gLoan.addAlways(c.loan.noPrintDiscount.label, -Math.abs(np)); }
      }
      if (money(ln.negotiatedFee) !== 0) {
        gLoan.add("Custom negotiated fee", money(ln.negotiatedFee), "Entered for this assignment");
      }
      ctx.warnings.push("Georgia is an attorney closing state. This quote does not authorize an " +
                        "independent real estate closing.");
    }
    if (!gLoan.isEmpty()) { groups.push(gLoan); }

    /* =======================================================
       12. APOSTILLE
       ======================================================= */
    var gApoFee = new Group("12. Apostille professional fees");
    var gApoGov = new Group("13. Government, shipping and third party costs, not business income");
    var governmentTotal = 0;
    var isApostille = svcKey.indexOf("apostille") === 0 || (i.apostille && i.apostille.include);

    if (isApostille) {
      var ap = i.apostille || {};
      var apDocs = Math.max(1, count(ap.documents) || 1);

      if (svcKey !== "apostille") {
        gApoFee.addAlways(c.apostille.facilitationFirst.label,
                          ctx.use(c.apostille.facilitationFirst,
                                  "apostille.facilitationFirst", "Apostille section"));
      } else {
        gApoFee.addAlways("Facilitation, first document", 0,
                          "Already included in the " + fmt(effectiveBase) + " base price");
        ctx.warnings.push("Duplicate charge prevented: the first apostille document is already in " +
                          "the base facilitation price and was not charged twice.");
      }

      var addlDocs = apDocs - 1;
      if (addlDocs > 0) {
        var addlRate = ctx.use(c.apostille.facilitationAddl,
                               "apostille.facilitationAddl", "Apostille section");
        gApoFee.addAlways(addlDocs + " additional document" + (addlDocs > 1 ? "s" : "") +
                          " at " + fmt(addlRate), addlDocs * addlRate);
      }

      /* Pickup and return delivery together are $70, not $40 plus $40. */
      if (ap.pickup && ap.dropoff) {
        gApoFee.addAlways(c.apostille.pickupAndReturn.label,
                          ctx.use(c.apostille.pickupAndReturn, "apostille.pickupAndReturn",
                                  "Apostille section"),
                          "Combined rate, cheaper than the two separate charges");
        ctx.warnings.push("Duplicate charge prevented: pickup and return delivery were billed at the " +
                          "combined rate instead of two separate charges.");
      } else if (ap.pickup) {
        gApoFee.addAlways(c.apostille.pickup.label,
                          ctx.use(c.apostille.pickup, "apostille.pickup", "Apostille section"));
      } else if (ap.dropoff) {
        gApoFee.addAlways(c.apostille.dropoff.label,
                          ctx.use(c.apostille.dropoff, "apostille.dropoff", "Apostille section"));
      }
      if (ap.rush) {
        gApoFee.addAlways(c.apostille.rushHandling.label,
                          ctx.use(c.apostille.rushHandling, "apostille.rushHandling", "Apostille section"));
      }

      /* Variable outside costs. Selecting one requires an amount. */
      [["certifiedCopy", ap.certifiedCopyCost, "Certified copies"],
       ["translation", ap.translationCost, "Translation"]].forEach(function (v) {
        if (!ap[v[0]]) { return; }
        if (money(v[1]) > 0) {
          gApoFee.addAlways(v[2], money(v[1]), "Variable cost entered for this order");
        } else {
          ctx.missing.push({ path: "apostille." + v[0] + "Cost",
            label: v[2] + " selected but no amount entered",
            source: "Enter the cost for this order", where: "Apostille section" });
        }
      });

      var dest = ap.destinationType || "hague";
      if (dest === "hague") {
        var g1 = ctx.use(c.apostille.govGsccca, "apostille.govGsccca", "Apostille section");
        governmentTotal += apDocs * g1;
        gApoGov.addAlways("GSCCCA apostille: " + apDocs + " document" + (apDocs > 1 ? "s" : "") +
                          " at " + fmt(g1), apDocs * g1, "Government fee, paid to the State of Georgia");
      } else if (dest === "non_hague") {
        var g2 = ctx.use(c.apostille.govGreatSeal, "apostille.govGreatSeal", "Apostille section");
        governmentTotal += apDocs * g2;
        gApoGov.addAlways("Georgia Great Seal certification: " + apDocs + " document" +
                          (apDocs > 1 ? "s" : "") + " at " + fmt(g2), apDocs * g2,
                          "Government fee, non Hague destination");
      } else {
        ctx.missing.push({ path: "apostille.destination",
          label: "Destination type not yet determined, government fee cannot be calculated",
          source: "Select Hague or non Hague", where: "Apostille section" });
      }
      if (ap.federalAuth) {
        var g3 = ctx.use(c.apostille.govFederal, "apostille.govFederal", "Apostille section");
        governmentTotal += apDocs * g3;
        gApoGov.addAlways("US Department of State authentication: " + apDocs + " document" +
                          (apDocs > 1 ? "s" : "") + " at " + fmt(g3), apDocs * g3, "Government fee");
      }

      /* Amounts typed per appointment. Never blocking. */
      [["countyAuth", ap.countyAuthCost, "County authentication", "Government fee, varies by county"],
       ["embassy", ap.embassyCost, "Embassy or consulate legalization", "Government fee, varies by country"],
       ["shipDom", ap.shippingDomestic, "Domestic return shipping", "Shipping cost"],
       ["shipIntl", ap.shippingInternational, "International return shipping", "Shipping cost"],
       ["courier", ap.courierCost, "Courier cost", "Third party cost"],
       ["third", ap.thirdPartyCost, "Other third party cost", "Third party cost"]].forEach(function (r) {
        if (money(r[1]) !== 0) {
          governmentTotal += money(r[1]);
          gApoGov.addAlways(r[2], money(r[1]), r[3]);
        }
      });
      if (ap.embassy && money(ap.embassyCost) === 0) {
        ctx.missing.push({ path: "apostille.embassyCost",
          label: "Embassy or consulate legalization cost not entered",
          source: "Enter the cost for this appointment", where: "Apostille section" });
      }

      ctx.warnings.push("Apostille eligibility, processing time and acceptance are decided by the " +
                        "relevant government authority and cannot be guaranteed.");
    }
    if (!gApoFee.isEmpty()) { groups.push(gApoFee); }

    /* =======================================================
       BUSINESS FEES SUBTOTAL
       ======================================================= */
    var statutoryTotal = gStat.sum();
    var businessFees = 0;
    groups.forEach(function (g) {
      if (g === gStat || g === gPass) { return; }
      businessFees += g.sum();
    });
    businessFees = money(businessFees);

    /* =======================================================
       14. DISCOUNTS AND ADJUSTMENTS
       ======================================================= */
    var gDisc = new Group("14. Discounts and adjustments");
    var d = i.discounts || {};
    var discountTotal = 0;

    Object.keys(c.discounts).forEach(function (key) {
      if (!d[key]) { return; }
      var amt;
      if (d[key + "Amount"] !== undefined && d[key + "Amount"] !== null && d[key + "Amount"] !== "") {
        amt = Math.abs(money(d[key + "Amount"]));
      } else {
        amt = Math.abs(ctx.use(c.discounts[key], "discounts." + key, "Discounts section"));
      }
      if (amt > 0) {
        gDisc.addAlways(c.discounts[key].label, -amt);
        discountTotal -= amt;
      }
    });

    if (money(d.manualIncrease) > 0) {
      gDisc.addAlways("Manual fee increase", money(d.manualIncrease), d.manualReason || "");
      discountTotal += money(d.manualIncrease);
    }
    if (money(d.manualReduction) > 0) {
      gDisc.addAlways("Manual fee reduction", -Math.abs(money(d.manualReduction)), d.manualReason || "");
      discountTotal -= Math.abs(money(d.manualReduction));
    }
    if ((money(d.manualIncrease) > 0 || money(d.manualReduction) > 0) &&
        !(d.manualReason && String(d.manualReason).trim().length > 0)) {
      ctx.missing.push({ path: "adjustments.reason",
        label: "A reason is required for a manual price override",
        source: "Enter a reason", where: "Discounts and adjustments" });
    }
    if (money(d.customAdjustment) !== 0) {
      gDisc.addAlways("Custom adjustment", money(d.customAdjustment), d.customAdjustmentNote || "");
      discountTotal += money(d.customAdjustment);
    }
    if (!gDisc.isEmpty()) { groups.push(gDisc); }

    /* =======================================================
       MINIMUM TRIP CHARGE
       ======================================================= */
    var afterDiscounts = money(businessFees + discountTotal);
    var minEntry = c.rules.minimumTripCharge;
    var minimumApplied = false;
    var minimum = 0;

    if (minEntry.enabled !== false && afterDiscounts < money(minEntry.amount) && !i.overrideMinimum) {
      minimum = ctx.use(minEntry, "rules.minimumTripCharge", "Global rules");
      if (minimum > 0 && afterDiscounts < minimum) {
        var gMin = new Group("15. Minimum trip charge");
        gMin.addAlways("Adjustment to the " + fmt(minimum) + " minimum trip charge",
                       money(minimum - afterDiscounts), "The quote fell below your minimum");
        groups.push(gMin);
        afterDiscounts = minimum;
        minimumApplied = true;
        ctx.warnings.push("This quote was below your " + fmt(minimum) +
                          " minimum trip charge and was raised to the minimum.");
      }
    } else if (i.overrideMinimum) {
      ctx.warnings.push("MANUAL OVERRIDE: the minimum trip charge was bypassed. Reason: " +
                        (i.overrideReason || "none given"));
      if (!i.overrideReason) {
        ctx.missing.push({ path: "adjustments.overrideReason",
          label: "A reason is required to bypass the minimum trip charge",
          source: "Enter a reason", where: "Discounts and adjustments" });
      }
    }

    /* =======================================================
       FINAL TOTALS
       ======================================================= */
    var subtotal = money(afterDiscounts + statutoryTotal + passThrough + governmentTotal);

    var taxAmount = 0;
    if (c.rules.tax.enabled && money(c.rules.tax.amount) > 0) {
      taxAmount = money(afterDiscounts * (money(c.rules.tax.amount) / 100));
    }
    var cardAmount = 0;
    if (c.rules.cardAdjustment.enabled && money(c.rules.cardAdjustment.amount) > 0 && i.applyCardAdjustment) {
      cardAmount = money((subtotal + taxAmount) * (money(c.rules.cardAdjustment.amount) / 100));
    }

    var estimatedTotal = money(subtotal + taxAmount + cardAmount);

    if (i.overrideTotal !== undefined && i.overrideTotal !== null && i.overrideTotal !== "") {
      var ot = money(i.overrideTotal);
      ctx.warnings.push("MANUAL TOTAL OVERRIDE: the calculated total of " + fmt(estimatedTotal) +
                        " was replaced with " + fmt(ot) + ". Reason: " +
                        (i.overrideReason || "none given"));
      if (!i.overrideReason) {
        ctx.missing.push({ path: "adjustments.overrideReason",
          label: "A reason is required to replace the calculated total",
          source: "Enter a reason", where: "Discounts and adjustments" });
      }
      estimatedTotal = ot;
    }

    var deposit = Math.max(0, money(i.depositPaid));
    if (deposit > estimatedTotal) {
      ctx.warnings.push("The deposit entered is larger than the estimated total. Confirm the amount.");
    }

    if (governmentTotal > 0) {
      groups.push(gApoGov);
      ctx.warnings.push("Government, embassy, shipping and third party costs of " + fmt(governmentTotal) +
                        " are pass through amounts and are not business income.");
    }

    return finish(ctx, {
      groups: groups,
      totals: {
        businessFees: money(afterDiscounts),
        statutory: statutoryTotal,
        passThrough: money(passThrough),
        government: money(governmentTotal),
        discounts: money(discountTotal),
        subtotal: subtotal,
        tax: taxAmount,
        cardAdjustment: cardAmount,
        estimatedTotal: estimatedTotal,
        deposit: deposit,
        balanceDue: money(estimatedTotal - deposit),
        minimumApplied: minimumApplied
      }
    });
  }

  var api = { calculateQuote: calculateQuote, fmt: fmt, money: money, count: count, num: num };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  root.QuoteEngine = api;

})(typeof window !== "undefined" ? window : this);
