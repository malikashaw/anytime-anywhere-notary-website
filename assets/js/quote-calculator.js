/* ===========================================================
   Anytime Anywhere Mobile Notary Services LLC
   Quote calculator application

   Responsibilities:
     - build the form controls from the pricing configuration
     - gather inputs and call QuoteEngine.calculateQuote
     - render the itemized quote
     - build the text message and email drafts
     - save, search and delete quotes in this browser only
     - the private pricing settings panel

   Nothing here contains a price. Every rate comes from
   pricing-config.js or from your saved overrides.
   =========================================================== */

(function () {
  "use strict";

  var STORE_QUOTES = "aan_quotes_v1";
  var STORE_CONFIG = "aan_pricing_v1";
  var STORE_COUNTER = "aan_quote_counter_v1";

  var CFG = null;          /* working configuration */
  var LAST = null;         /* last calculation result */
  var LAST_INPUTS = null;
  var CURRENT_QUOTE_NO = null;
  var CURRENT_CREATED = null;
  var CUSTOM_RATES = {};   /* per quote amounts you type for blocked items */

  var $ = function (id) { return document.getElementById(id); };
  var fmt = window.QuoteEngine.fmt;

  /* =========================================================
     STORAGE
     ========================================================= */
  function safeGet(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function safeSet(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast("Could not save. Browser storage may be full or blocked."); return false; }
  }
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Merge saved overrides onto the shipped defaults so that new
     config keys added later still appear for you. */
  function mergeConfig(base, saved) {
    if (!saved || typeof saved !== "object") { return base; }
    Object.keys(saved).forEach(function (k) {
      if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k]) &&
          typeof saved[k] === "object" && !Array.isArray(saved[k])) {
        mergeConfig(base[k], saved[k]);
      } else {
        base[k] = saved[k];
      }
    });
    return base;
  }

  function loadConfig() {
    CFG = mergeConfig(deepClone(window.PRICING_CONFIG), safeGet(STORE_CONFIG, null));
  }

  /* =========================================================
     SMALL UI HELPERS
     ========================================================= */
  function toast(msg) {
    var t = $("qcToast");
    t.textContent = msg;
    t.classList.add("qc-show");
    window.clearTimeout(t._timer);
    t._timer = window.setTimeout(function () { t.classList.remove("qc-show"); }, 2600);
  }

  function copyText(text, label) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast(label + " copied"); },
        function () { fallbackCopy(text, label); }
      );
    } else { fallbackCopy(text, label); }
  }
  function fallbackCopy(text, label) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); toast(label + " copied"); }
    catch (e) { toast("Copy is not available. Select the text manually."); }
    document.body.removeChild(ta);
  }

  /* Run a DOM rebuild without stealing the caret or moving the page. */
  function preserveUI(fn) {
    var doc = document;
    var active = doc.activeElement;
    var id = active && active.id ? active.id : null;
    var selStart = null, selEnd = null;
    try {
      if (active && typeof active.selectionStart === "number") {
        selStart = active.selectionStart; selEnd = active.selectionEnd;
      }
    } catch (e) { /* number and date inputs throw, ignore */ }
    var scrollY = window.pageYOffset || doc.documentElement.scrollTop || 0;

    fn();

    if (id) {
      var el = doc.getElementById(id);
      if (el && el !== doc.activeElement) {
        try { el.focus({ preventScroll: true }); } catch (e2) { el.focus(); }
        if (selStart !== null) {
          try { el.setSelectionRange(selStart, selEnd); } catch (e3) { /* unsupported type */ }
        }
      }
    }
    var nowY = window.pageYOffset || doc.documentElement.scrollTop || 0;
    if (Math.abs(nowY - scrollY) > 1) { window.scrollTo(0, scrollY); }
  }

  function val(id) { var el = $(id); return el ? el.value : ""; }
  function numVal(id) {
    var v = parseFloat(val(id));
    return (isNaN(v) || !isFinite(v)) ? 0 : v;
  }
  function intVal(id) {
    var v = Math.floor(numVal(id));
    return v < 0 ? 0 : v;
  }
  function checked(id) { var el = $(id); return !!(el && el.checked); }

  function opt(value, label) {
    var o = document.createElement("option");
    o.value = value; o.textContent = label;
    return o;
  }

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* =========================================================
     BUILD FORM CONTROLS FROM CONFIG
     ========================================================= */
  function buildSelects() {
    var svc = $("service");
    svc.innerHTML = "";
    Object.keys(CFG.services).forEach(function (k) {
      var s = CFG.services[k];
      if (s.enabled === false) { return; }
      var eff = s.base;
      if (s.pricingMode === "use_general" && s.aliasOf && CFG.services[s.aliasOf]) {
        eff = CFG.services[s.aliasOf].base;
      }
      var suffix = (s.status === "custom_required" || s.pricingMode === "custom")
                 ? " (custom quote required)"
                 : (eff > 0 ? " (starting at " + fmt(eff) + ")" : "");
      svc.appendChild(opt(k, s.label + suffix));
    });

    var tm = $("timing");
    tm.innerHTML = "";
    Object.keys(CFG.timing).forEach(function (k) {
      var t = CFG.timing[k];
      if (t.enabled === false) { return; }
      var suffix = "";
      if (t.tierBase) { suffix = " (starting at " + fmt(t.tierBase) + ")"; }
      else if (t.premium > 0) { suffix = " (+" + fmt(t.premium) + ")"; }
      tm.appendChild(opt(k, t.label + suffix));
    });

    var ur = $("urgency");
    ur.innerHTML = "";
    Object.keys(CFG.urgency).forEach(function (k) {
      var u = CFG.urgency[k];
      if (u.enabled === false) { return; }
      ur.appendChild(opt(k, u.label + (u.amount > 0 ? " (+" + fmt(u.amount) + ")" : "")));
    });

    var tz = $("travelZone");
    tz.innerHTML = "";
    Object.keys(CFG.travel.zones).forEach(function (k) {
      var z = CFG.travel.zones[k];
      if (z.enabled === false) { return; }
      tz.appendChild(opt(k, z.label + " (" + fmt(z.amount) + ")"));
    });

    var lt = $("locationType");
    lt.innerHTML = "";
    lt.appendChild(opt("", "Not specified"));
    Object.keys(CFG.locations).forEach(function (k) {
      var l = CFG.locations[k];
      if (l.enabled === false) { return; }
      lt.appendChild(opt(k, l.label + (l.amount > 0 ? " (+" + fmt(l.amount) + ")" : "")));
    });

    var ct = $("cancellationType");
    ct.innerHTML = "";
    ct.appendChild(opt("", "Not applicable"));
    Object.keys(CFG.cancellation).forEach(function (k) {
      var c = CFG.cancellation[k];
      if (c.enabled === false) { return; }
      ct.appendChild(opt(k, c.label + " (" + fmt(c.amount) + ")"));
    });

    var pm = $("payMethod");
    pm.innerHTML = "";
    pm.appendChild(opt("", "Not selected"));
    CFG.paymentMethods.forEach(function (m) { pm.appendChild(opt(m, m)); });

    var pt = $("payTerms");
    pt.innerHTML = "";
    pt.appendChild(opt("", "Not selected"));
    CFG.paymentTerms.forEach(function (m) { pt.appendChild(opt(m, m)); });

    var dc = $("discountChecks");
    dc.innerHTML = "";
    Object.keys(CFG.discounts).forEach(function (k) {
      var d = CFG.discounts[k];
      if (d.enabled === false) { return; }
      var lab = document.createElement("label");
      lab.className = "qc-check";
      lab.innerHTML = '<input type="checkbox" id="disc_' + esc(k) + '"><span>' +
                      esc(d.label) + (d.amount > 0 ? " (" + fmt(d.amount) + ")" : " (no approved amount)") +
                      "</span>";
      dc.appendChild(lab);
    });

    $("waitIncluded").value = CFG.rules.includedMinutes.amount;
    $("qcSchedVersion").textContent = CFG.meta.schedulePriceVersion;
    $("qcSchedDate").textContent = CFG.meta.effectiveDate;
    $("travelMeasurement").value = CFG.travel.measurement;
    $("cardAdjWrap").hidden = !CFG.rules.cardAdjustment.enabled;
  }

  /* =========================================================
     GATHER INPUTS
     ========================================================= */
  function gather() {
    var svcKey = val("service");
    return {
      service: svcKey,
      customServiceAmount: numVal("customServiceAmount"),
      customServiceLabel: val("customServiceLabel"),
      timing: val("timing"),
      urgency: val("urgency"),
      customTimingFee: numVal("customTimingFee"),
      locationType: val("locationType"),

      travel: {
        /* The mileage zone dropdown was retired in schedule 3.2.
           Exact one way mileage is the only automatic method, so a
           zone can never charge travel alongside the mileage field. */
        mode: (val("travelMode") === "zone" ? "miles" : val("travelMode")),
        zone: val("travelZone"),
        miles: numVal("travelMiles"),
        customAmount: numVal("travelCustom"),
        overrideAmount: val("travelOverride"),
        overrideReason: val("travelOverrideReason"),
        measurement: val("travelMeasurement"),
        additionalStops: intVal("travelStops"),
        returnTrip: checked("travelReturnTrip"),
        parking: numVal("travelParking"),
        tolls: numVal("travelTolls"),
        valet: numVal("travelValet")
      },

      counts: {
        documents: intVal("cntDocuments"),
        signers: intVal("cntSigners"),
        acts: intVal("cntActs"),
        stamps: intVal("cntStamps"),
        witnessesRequired: intVal("cntWitnessReq"),
        witnessesProvided: intVal("cntWitnessProv")
      },

      waitingMinutes: intVal("waitTotal"),
      customDelayFee: numVal("customDelayFee"),
      waitingReason: val("waitReason"),

      printing: {
        mode: val("prMode"),
        pages: intVal("prPages"),
        scanbackPages: intVal("prScan"),
        faxbacks: checked("prFaxbacks"),
        shippingLabel: checked("prShippingLabel"),
        carrierDropOff: checked("prCarrierDropOff"),
        courierOnly: checked("prCourierOnly"),
        emailDocs: checked("prEmailDocs"),
        packaging: checked("prPackaging"),
        docPickup: checked("prDocPickup"),
        docReturn: checked("prDocReturn"),
        courierStops: intVal("prCourierStops"),
        customHandling: numVal("prCustom")
      },

      witness: {
        coordination: checked("witCoordination"),
        custom: numVal("witCustom")
      },

      apostille: {
        include: checked("apInclude"),
        documents: intVal("apDocs"),
        destinationType: val("apDestType"),
        federalAuth: checked("apFederalAuth"),
        countyAuth: checked("apCountyAuth"),
        countyAuthCost: numVal("apCountyCost"),
        embassy: checked("apEmbassy"),
        embassyCost: numVal("apEmbassyCost"),
        translation: checked("apTranslation"),
        certifiedCopy: checked("apCertifiedCopy"),
        notarizeBefore: checked("apNotarizeBefore"),
        pickup: checked("apPickup"),
        dropoff: checked("apDropoff"),
        rush: checked("apRush"),
        shippingDomestic: numVal("apShipDom"),
        shippingInternational: numVal("apShipIntl"),
        courierCost: numVal("apCourierCost"),
        thirdPartyCost: numVal("apThirdParty"),
        certifiedCopyCost: numVal("apCertifiedCost"),
        translationCost: numVal("apTranslationCost")
      },

      loan: {
        attorneySupervisionConfirmed: checked("loanConfirmed"),
        quotePending: checked("loanPending"),
        additionalSigners: intVal("loanAddlSigners"),
        additionalProperties: intVal("loanAddlProps"),
        sellerBuyerCombo: checked("loanCombo"),
        trustOrPoa: checked("loanTrustPoa"),
        faxbacks: checked("loanFaxbacks"),
        resignReturn: checked("loanResign"),
        noPrint: checked("loanNoPrint"),
        negotiatedFee: numVal("loanNegotiated")
      },

      i9: {
        employees: Math.max(1, intVal("i9Employees")),
        separateLocations: intVal("i9SeparateLocations"),
        portal: checked("i9Portal"),
        upload: checked("i9Upload"),
        printing: checked("i9Printing"),
        rush: checked("i9Rush"),
        businessRate: checked("i9BusinessRate")
      },

      discounts: gatherDiscounts(),

      cancellationOnly: checked("cancellationOnly"),
      cancellationType: val("cancellationType"),

      depositPaid: numVal("depositPaid"),
      overrideMinimum: checked("overrideMinimum"),
      overrideReason: val("adjReason"),
      overrideTotal: val("overrideTotal"),
      applyCardAdjustment: checked("applyCardAdjustment"),
      customRates: CUSTOM_RATES
    };
  }

  function gatherDiscounts() {
    var d = {
      manualIncrease: numVal("adjIncrease"),
      manualReduction: numVal("adjReduction"),
      customAdjustment: numVal("adjCustom"),
      manualReason: val("adjReason")
    };
    Object.keys(CFG.discounts).forEach(function (k) {
      d[k] = checked("disc_" + k);
    });
    return d;
  }

  /* =========================================================
     RENDER
     ========================================================= */
  function nextQuoteNumber() {
    var n = safeGet(STORE_COUNTER, 0) + 1;
    safeSet(STORE_COUNTER, n);
    var d = new Date();
    var ym = "" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0");
    return CFG.meta.quotePrefix + "-" + ym + "-" + String(n).padStart(4, "0");
  }

  function expiryDate(from) {
    var d = new Date(from.getTime());
    d.setDate(d.getDate() + parseInt(CFG.meta.quoteExpirationDays, 10));
    return d;
  }

  function dateStr(d) {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }
  function dateTimeStr(d) {
    return d.toLocaleString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit"
    });
  }

  function apptStr() {
    var d = val("apptDate"), t = val("apptTime");
    if (!d && !t) { return "To be scheduled"; }
    var out = "";
    if (d) {
      var parts = d.split("-");
      out = dateStr(new Date(parts[0], parts[1] - 1, parts[2]));
    }
    if (t) {
      var hm = t.split(":");
      var hr = parseInt(hm[0], 10);
      var ampm = hr >= 12 ? "PM" : "AM";
      var h12 = hr % 12; if (h12 === 0) { h12 = 12; }
      out += (out ? " at " : "") + h12 + ":" + hm[1] + " " + ampm;
    }
    return out;
  }

  function locationStr() {
    var parts = [];
    if (val("facName")) { parts.push(val("facName")); }
    if (val("facRoom")) { parts.push("Room " + val("facRoom")); }
    if (val("apptAddress")) { parts.push(val("apptAddress")); }
    if (!parts.length) {
      var lk = val("locationType");
      if (lk && CFG.locations[lk]) { return CFG.locations[lk].label; }
      return "To be confirmed";
    }
    return parts.join(", ");
  }

  function serviceLabel() {
    var s = CFG.services[val("service")];
    return s ? s.label : "Notary service";
  }

  function recalc() {
    var inputs = gather();
    var result = window.QuoteEngine.calculateQuote(inputs, CFG);
    LAST = result;
    LAST_INPUTS = inputs;

    if (!CURRENT_QUOTE_NO) {
      CURRENT_QUOTE_NO = nextQuoteNumber();
      CURRENT_CREATED = new Date();
    }

    preserveUI(function () {
      renderBlocked(result);
      renderIncomplete(result);
      renderResult(result);
      renderDrafts(result);
      updateTags(result);
      applyOutputGate(result);
    });

    if (result.blocked) { $("stickyTotal").textContent = "On hold"; }
    else if (result.completeness === "unavailable") { $("stickyTotal").textContent = "Unavailable"; }
    else { $("stickyTotal").textContent = fmt(result.totals.estimatedTotal); }
  }

  /* Client facing output is allowed only on a complete, client ready quote. */
  var GATED_BUTTONS = ["btnCopyTotal", "btnCopyItemized", "btnCopyText", "btnCopyEmail",
                       "btnPrint", "btnSave", "btnStickyCopy"];

  function applyOutputGate(r) {
    var allow = !r.blocked && r.clientReady;
    GATED_BUTTONS.forEach(function (id) {
      var el = $(id);
      if (!el) { return; }
      el.disabled = !allow;
      el.setAttribute("aria-disabled", allow ? "false" : "true");
      el.title = allow ? "" : "Unavailable until every required rate is approved or given a custom amount.";
      el.style.opacity = allow ? "" : "0.45";
      el.style.cursor = allow ? "" : "not-allowed";
    });
  }

  /* The incomplete panel lists every blocking item and lets you type an
     amount for this one appointment without changing your rate sheet. */
  var LAST_INCOMPLETE_SIG = null;

  function renderIncomplete(r) {
    var el = $("qcIncomplete");

    /* Rebuilding this panel destroys any custom rate input the user is
       typing in, so only rebuild when its contents actually change. */
    var sig = r.blocked ? "blocked" :
      r.completeness + "|" +
      r.missing.map(function (m) { return m.path; }).join(",") + "|" +
      r.proposed.map(function (pp) { return pp.path; }).join(",");
    if (sig === LAST_INCOMPLETE_SIG) { return; }
    LAST_INCOMPLETE_SIG = sig;

    if (r.blocked) { el.innerHTML = ""; return; }

    var html = "";

    if (r.completeness === "unavailable") {
      html += '<div class="qc-note qc-note-legal">' +
        '<strong style="font-size:1.05rem">Incomplete quote</strong><br>' +
        "<strong>Final total unavailable.</strong> The rates below have no approved amount. " +
        "Enter an amount for this appointment, or approve a rate in Pricing Settings." +
        '<div style="margin-top:.8rem">';
      r.missing.forEach(function (m) {
        if (m.isPolicy || m.path.indexOf("adjustments.") === 0 ||
            m.path === "cancellation.none" || m.path === "apostille.destination") {
          html += '<div class="qc-line"><span class="qc-lbl">' + esc(m.label) +
                  "<small>" + esc(m.where) + "</small></span></div>";
          return;
        }
        var cur = CUSTOM_RATES[m.path];
        html += '<div class="qc-rate" style="border-bottom-color:rgba(179,38,30,.25)">' +
          '<span class="qc-rate-label">' + esc(m.label) +
            "<small style=\"display:block;color:var(--text-muted);font-size:.78rem\">" +
            esc(m.where) + ". " + esc(m.source) + "</small></span>" +
          '<input type="number" step="0.01" min="0" inputmode="decimal" placeholder="0.00" ' +
            'data-customrate="' + esc(m.path) + '" value="' +
            (cur === undefined ? "" : esc(cur)) + '" aria-label="Custom amount for ' + esc(m.label) + '">' +
          "<span></span></div>";
      });
      html += "</div></div>";
    } else if (r.completeness === "internal_only") {
      html += '<div class="qc-note qc-note-warn">' +
        "<strong>Internal estimate only.</strong> This quote uses a rate that is still proposed " +
        "and awaiting your approval, so it cannot be sent to a client. Approve the rate in " +
        "Pricing Settings to unlock the client outputs." +
        '<ul style="margin:.5rem 0 0;padding-left:1.1rem">';
      r.proposed.forEach(function (p) {
        html += "<li>" + esc(p.label) + ", " + fmt(p.amount) + "</li>";
      });
      html += "</ul></div>";
    }

    el.innerHTML = html;
  }

  function renderBlocked(r) {
    var el = $("qcBlocked");
    if (!r.blocked) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="qc-note qc-note-legal"><strong>Quote on hold.</strong><br>' +
                   esc(r.blockReason) + "</div>";
  }

  function renderResult(r) {
    var box = $("qcResult");
    if (r.blocked) {
      box.innerHTML = '<p class="qc-note qc-note-legal">No total is calculated until attorney ' +
                      "supervision is confirmed or the quote is marked pending.</p>";
      return;
    }

    var created = CURRENT_CREATED || new Date();
    var html = "";

    html += '<div class="qc-result-head">' +
      '<img src="' + esc(CFG.meta.logo) + '" alt="' + esc(CFG.meta.business) + ' logo">' +
      '<div class="qc-rh-text">' +
        "<h2>" + esc(CFG.meta.business) + "</h2>" +
        "<p>" + esc(CFG.meta.phone) + " &nbsp;&middot;&nbsp; " + esc(CFG.meta.email) + "</p>" +
        "<p>" + esc(CFG.meta.serviceArea) + "</p>" +
        '<p class="qc-quoteno">Quote ' + esc(CURRENT_QUOTE_NO) + "</p>" +
      "</div></div>";

    html += '<div class="qc-detail-grid">' +
      dl("Quote date", dateTimeStr(created)) +
      dl("Quote expires", dateStr(expiryDate(created))) +
      dl("Client", val("cliName") || "Not recorded") +
      dl("Service", serviceLabel()) +
      dl("Appointment", apptStr()) +
      dl("Location", locationStr()) +
      dl("Payment method", val("payMethod") || "To be confirmed") +
      dl("Payment terms", val("payTerms") || "To be confirmed") +
      "</div>";

    html += '<div class="qc-lines">';
    r.groups.forEach(function (g) {
      if (!g.lines.length) { return; }
      html += "<h4>" + esc(g.title) + "</h4>";
      g.lines.forEach(function (l) {
        var cls = l.amount < 0 ? " qc-neg" : (l.amount === 0 ? " qc-zero" : "");
        html += '<div class="qc-line"><span class="qc-lbl">' + esc(l.label) +
                (l.detail ? "<small>" + esc(l.detail) + "</small>" : "") +
                '</span><span class="qc-amt' + cls + '">' + fmt(l.amount) + "</span></div>";
      });
    });
    html += "</div>";

    var t = r.totals;
    html += '<div class="qc-totals">';
    html += totalRow("Service fees", t.businessFees);
    if (t.statutory)   { html += totalRow("Georgia statutory notarial fee", t.statutory); }
    if (t.passThrough) { html += totalRow("Parking, tolls and pass through costs", t.passThrough); }
    if (t.government)  { html += totalRow("Government, shipping and third party costs", t.government); }
    if (t.tax)         { html += totalRow("Tax", t.tax); }
    if (t.cardAdjustment) { html += totalRow("Card processing adjustment", t.cardAdjustment); }
    if (r.completeness === "unavailable") {
      html += '<div class="qc-total-row qc-grand"><span>Estimated total</span>' +
              '<span class="qc-amt" style="font-size:1.15rem;color:#b3261e">Final total unavailable</span></div>';
    } else {
      html += '<div class="qc-total-row qc-grand"><span>Estimated total' +
              (r.completeness === "internal_only" ? ' <small style="display:block;font-size:.75rem;color:#5b4708">Internal estimate, not client ready</small>' : "") +
              '</span><span class="qc-amt">' + fmt(t.estimatedTotal) + "</span></div>";
    }
    if (t.deposit) {
      html += totalRow("Deposit already paid", -t.deposit);
      html += '<div class="qc-total-row qc-balance"><span>Remaining balance due</span><span class="qc-amt">' +
              fmt(t.balanceDue) + "</span></div>";
    }
    if (numVal("depositRequired") > 0) {
      html += totalRow("Deposit required to confirm", numVal("depositRequired"));
    }
    html += "</div>";

    if (r.warnings.length) {
      html += '<div class="qc-note qc-note-warn qc-noprint"><strong>Internal notices</strong><ul style="margin:.5rem 0 0;padding-left:1.1rem">';
      r.warnings.forEach(function (w) { html += "<li>" + esc(w) + "</li>"; });
      html += "</ul></div>";
    }
    if (r.missing && r.missing.length) {
      html += '<div class="qc-note qc-note-legal qc-noprint"><strong>Rates still requiring approval</strong><ul style="margin:.5rem 0 0;padding-left:1.1rem">';
      r.missing.forEach(function (m) { html += "<li>" + esc(m.label) + "</li>"; });
      html += "</ul></div>";
    }

    if (val("cliNotes")) {
      html += "<h4 style=\"font-family:var(--body);font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;color:var(--purple);margin-top:1.4rem\">Notes</h4><p>" +
              esc(val("cliNotes")) + "</p>";
    }

    if (checked("includeChecklist")) {
      html += "<h4 style=\"font-family:var(--body);font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;color:var(--purple);margin-top:1.4rem\">Before your appointment</h4><ul style=\"padding-left:1.1rem;font-size:.9rem\">";
      CFG.checklist.forEach(function (c) { html += "<li>" + esc(c) + "</li>"; });
      html += "</ul>";
    }

    html += "<h4 style=\"font-family:var(--body);font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;color:var(--purple);margin-top:1.4rem\">Important information</h4>";
    html += '<p style="font-size:.82rem;color:var(--text-muted);line-height:1.6">' +
            esc(CFG.disclaimers.estimate) + " " + esc(CFG.disclaimers.notarial) + " " +
            esc(CFG.disclaimers.notLegal) + " " + esc(CFG.disclaimers.finalPricing) + "</p>";
    if (LAST_INPUTS.apostille.include || val("service").indexOf("apostille") === 0) {
      html += '<p style="font-size:.82rem;color:var(--text-muted);line-height:1.6">' + esc(CFG.disclaimers.apostille) + "</p>";
    }
    if (CFG.services[val("service")] && CFG.services[val("service")].loan) {
      html += '<p style="font-size:.82rem;color:var(--text-muted);line-height:1.6">' + esc(CFG.disclaimers.loan) + "</p>";
    }
    if (val("service") === "i9") {
      html += '<p style="font-size:.82rem;color:var(--text-muted);line-height:1.6">' + esc(CFG.disclaimers.i9) + "</p>";
    }
    if (intVal("cntWitnessProv") > 0 || checked("witCoordination")) {
      html += '<p style="font-size:.82rem;color:var(--text-muted);line-height:1.6">' + esc(CFG.disclaimers.witness) + "</p>";
    }

    box.innerHTML = html;
  }

  function dl(label, value) {
    return "<div><span class=\"qc-dl\">" + esc(label) + "</span>" + esc(value) + "</div>";
  }
  function totalRow(label, amount) {
    return '<div class="qc-total-row"><span>' + esc(label) +
           '</span><span class="qc-amt">' + fmt(amount) + "</span></div>";
  }

  function updateTags(r) {
    var t = r.totals;
    setTag("tagTravel", groupSum(r, "2."));
    setTag("tagCounts", groupSum(r, "4."));
    setTag("tagTiming", groupSum(r, "6."));
    setTag("tagLocation", groupSum(r, "5."));
    setTag("tagWaiting", groupSum(r, "9."));
    setTag("tagPrinting", groupSum(r, "7."));
    setTag("tagWitness", groupSum(r, "8."));
    setTag("tagApostille", groupSum(r, "12."));
    setTag("tagLoan", groupSum(r, "11. Loan"));
    setTag("tagI9", groupSum(r, "11. I-9"));
    setTag("tagDiscounts", groupSum(r, "14."));
    setTag("tagCancel", r.groups.length && r.groups[0].title.indexOf("Cancellation") === 0 ? r.groups[0].sum() : 0);
  }
  function groupSum(r, prefix) {
    var total = 0;
    r.groups.forEach(function (g) { if (g.title.indexOf(prefix) === 0) { total += g.sum(); } });
    return total;
  }
  function setTag(id, amount) {
    var el = $(id);
    if (!el) { return; }
    el.textContent = amount ? fmt(amount) : "";
    el.style.display = amount ? "" : "none";
  }

  /* =========================================================
     TEXT AND EMAIL DRAFTS
     ========================================================= */
  function briefSummary(r) {
    var picked = [];
    r.groups.forEach(function (g) {
      g.lines.forEach(function (l) {
        if (l.amount > 0 && picked.length < 4) { picked.push(l.label.toLowerCase()); }
      });
    });
    return picked.join(", ");
  }

  function internalIncompleteMessage(r) {
    var list = r.missing.map(function (m) { return m.label; }).join("; ");
    return "Internal estimate incomplete. The following rates still require approval: " +
           (list || "none listed") + ".";
  }

  function buildTextMessage(r) {
    if (r.blocked) { return "Quote on hold: attorney supervision must be confirmed first."; }
    if (!r.clientReady) { return internalIncompleteMessage(r); }
    var t = r.totals;
    var name = val("cliName") ? val("cliName") + ", thank you" : "Thank you";
    var msg = name + " for contacting " + CFG.meta.business + ". Your estimated total for " +
      serviceLabel().toLowerCase() + " at " + locationStr() + " on " + apptStr() + " is " +
      fmt(t.estimatedTotal) + ". This includes " + briefSummary(r) + ".";
    if (t.deposit > 0) {
      msg += " A deposit of " + fmt(t.deposit) + " has been applied, leaving a balance of " +
             fmt(t.balanceDue) + ".";
    }
    if (numVal("depositRequired") > 0) {
      msg += " A deposit of " + fmt(numVal("depositRequired")) + " confirms the appointment.";
    }
    msg += " The quote is subject to confirmation of the documents, signer count, identification, " +
      "location, mileage, and appointment conditions. Reply YES to request the appointment.";
    return msg;
  }

  function buildEmail(r) {
    if (r.blocked) { return "Quote on hold: attorney supervision must be confirmed first."; }
    if (!r.clientReady) { return internalIncompleteMessage(r); }
    var t = r.totals;
    var created = CURRENT_CREATED || new Date();
    var L = [];

    L.push("Subject: Your quote from " + CFG.meta.business + " (" + CURRENT_QUOTE_NO + ")");
    L.push("");
    L.push(val("cliName") ? "Hello " + val("cliName") + "," : "Hello,");
    L.push("");
    L.push("Thank you for contacting " + CFG.meta.business + ". Here is your estimate.");
    L.push("");
    L.push("REQUESTED SERVICE");
    L.push("  " + serviceLabel());
    L.push("");
    L.push("APPOINTMENT DETAILS");
    L.push("  Date and time: " + apptStr());
    L.push("  Location: " + locationStr());
    if (val("destAddress")) { L.push("  Return delivery: " + val("destAddress")); }
    L.push("");
    L.push("ITEMIZED ESTIMATE");
    r.groups.forEach(function (g) {
      if (!g.lines.length) { return; }
      L.push("  " + g.title);
      g.lines.forEach(function (l) {
        L.push("    " + padRight(l.label, 54) + fmt(l.amount));
      });
    });
    L.push("");
    L.push("  " + padRight("Service fees", 54) + fmt(t.businessFees));
    if (t.statutory)   { L.push("  " + padRight("Georgia statutory notarial fee", 54) + fmt(t.statutory)); }
    if (t.passThrough) { L.push("  " + padRight("Parking, tolls and pass through costs", 54) + fmt(t.passThrough)); }
    if (t.government)  { L.push("  " + padRight("Government, shipping and third party costs", 54) + fmt(t.government)); }
    if (t.tax)         { L.push("  " + padRight("Tax", 54) + fmt(t.tax)); }
    L.push("  " + padRight("ESTIMATED TOTAL", 54) + fmt(t.estimatedTotal));
    if (t.deposit) {
      L.push("  " + padRight("Deposit already paid", 54) + fmt(-t.deposit));
      L.push("  " + padRight("REMAINING BALANCE", 54) + fmt(t.balanceDue));
    }
    L.push("");

    if (numVal("depositRequired") > 0) {
      L.push("DEPOSIT");
      L.push("  A deposit of " + fmt(numVal("depositRequired")) + " confirms this appointment.");
      L.push("");
    }

    L.push("PAYMENT OPTIONS");
    L.push("  " + CFG.paymentMethods.join(", ") + ".");
    if (val("payTerms")) { L.push("  Terms: " + val("payTerms") + "."); }
    L.push("");

    L.push("WHAT EACH SIGNER MUST HAVE");
    CFG.checklist.forEach(function (c) { L.push("  - " + c); });
    L.push("");

    L.push("TO CONFIRM");
    L.push("  Reply to this email or call " + CFG.meta.phone + " to confirm the appointment.");
    L.push("  This quote is valid through " + dateStr(expiryDate(created)) + ".");
    L.push("");

    L.push("IMPORTANT INFORMATION");
    L.push("  " + CFG.disclaimers.estimate);
    L.push("  " + CFG.disclaimers.notarial);
    L.push("  " + CFG.disclaimers.notLegal);
    if (LAST_INPUTS.apostille.include || val("service").indexOf("apostille") === 0) {
      L.push("  " + CFG.disclaimers.apostille);
    }
    if (CFG.services[val("service")] && CFG.services[val("service")].loan) {
      L.push("  " + CFG.disclaimers.loan);
    }
    if (val("service") === "i9") { L.push("  " + CFG.disclaimers.i9); }
    if (intVal("cntWitnessProv") > 0 || checked("witCoordination")) { L.push("  " + CFG.disclaimers.witness); }
    L.push("  " + CFG.disclaimers.finalPricing);
    L.push("");

    L.push(CFG.meta.business);
    L.push(CFG.meta.phone);
    L.push(CFG.meta.email);
    L.push(CFG.meta.website);
    L.push(CFG.meta.serviceArea);

    return L.join("\n");
  }

  function padRight(s, n) {
    s = String(s);
    if (s.length >= n) { return s.slice(0, n - 1) + " "; }
    return s + " ".repeat(n - s.length);
  }

  function buildItemized(r) {
    if (r.blocked) { return "Quote on hold."; }
    if (!r.clientReady) { return internalIncompleteMessage(r); }
    var L = [];
    L.push(CFG.meta.business);
    L.push("Quote " + CURRENT_QUOTE_NO + "  |  " + dateTimeStr(CURRENT_CREATED || new Date()));
    L.push("Client: " + (val("cliName") || "Not recorded"));
    L.push("Service: " + serviceLabel());
    L.push("Location: " + locationStr());
    L.push("Appointment: " + apptStr());
    L.push("");
    r.groups.forEach(function (g) {
      if (!g.lines.length) { return; }
      L.push(g.title);
      g.lines.forEach(function (l) {
        L.push("   " + padRight(l.label, 54) + fmt(l.amount));
        if (l.detail) { L.push("      " + l.detail); }
      });
      L.push("");
    });
    var t = r.totals;
    L.push(padRight("Service fees", 57) + fmt(t.businessFees));
    if (t.statutory)   { L.push(padRight("Georgia statutory notarial fee", 57) + fmt(t.statutory)); }
    if (t.passThrough) { L.push(padRight("Parking, tolls and pass through", 57) + fmt(t.passThrough)); }
    if (t.government)  { L.push(padRight("Government / shipping / third party", 57) + fmt(t.government)); }
    L.push(padRight("ESTIMATED TOTAL", 57) + fmt(t.estimatedTotal));
    if (t.deposit) {
      L.push(padRight("Deposit already paid", 57) + fmt(-t.deposit));
      L.push(padRight("BALANCE DUE", 57) + fmt(t.balanceDue));
    }
    return L.join("\n");
  }

  function renderDrafts(r) {
    $("outText").textContent = buildTextMessage(r);
    $("outEmail").textContent = buildEmail(r);
  }

  /* =========================================================
     SAVED QUOTES
     ========================================================= */
  function saveQuote() {
    if (!LAST) { recalc(); }
    if (LAST.blocked) { toast("Cannot save a quote that is on hold."); return; }
    if (!LAST.clientReady) {
      toast("Cannot save an incomplete quote. Approve or enter the missing rates first.");
      return;
    }

    var quotes = safeGet(STORE_QUOTES, []);
    var record = {
      quoteNo: CURRENT_QUOTE_NO,
      created: (CURRENT_CREATED || new Date()).toISOString(),
      status: "pending",
      clientName: val("cliName"),
      clientPhone: val("cliPhone"),
      clientEmail: val("cliEmail"),
      serviceKey: val("service"),
      serviceLabel: serviceLabel(),
      appointment: apptStr(),
      location: locationStr(),
      leadSource: val("leadSource"),
      total: LAST.totals.estimatedTotal,
      deposit: LAST.totals.deposit,
      depositRequired: numVal("depositRequired"),
      balance: LAST.totals.balanceDue,
      government: LAST.totals.government,
      paymentMethod: val("payMethod"),
      notes: val("cliNotes"),
      itemized: buildItemized(LAST)
    };

    var idx = -1;
    for (var i = 0; i < quotes.length; i++) {
      if (quotes[i].quoteNo === record.quoteNo) { idx = i; break; }
    }
    if (idx >= 0) { record.status = quotes[idx].status; quotes[idx] = record; }
    else { quotes.unshift(record); }

    if (safeSet(STORE_QUOTES, quotes)) {
      toast("Quote " + record.quoteNo + " saved on this device");
      renderSaved(); renderDashboard();
    }
  }

  function renderSaved() {
    var quotes = safeGet(STORE_QUOTES, []);
    var q = val("searchSaved").toLowerCase().trim();
    var list = $("savedList");

    var filtered = quotes.filter(function (r) {
      if (!q) { return true; }
      return [r.quoteNo, r.clientName, r.clientPhone, r.clientEmail, r.serviceLabel,
              r.created.slice(0, 10), r.appointment, r.location]
        .join(" ").toLowerCase().indexOf(q) !== -1;
    });

    if (!filtered.length) {
      list.innerHTML = '<p class="qc-note qc-note-info">' +
        (quotes.length ? "No quotes match that search." : "No saved quotes yet on this device.") + "</p>";
      return;
    }

    list.innerHTML = filtered.map(function (r) {
      return '<div class="qc-savedcard">' +
        '<div class="qc-sc-main">' +
          "<strong>" + esc(r.clientName || "No client name") + "</strong>" +
          "<small>" + esc(r.quoteNo) + " &middot; " + esc(r.serviceLabel) + " &middot; " +
          esc(new Date(r.created).toLocaleDateString("en-US")) + "</small>" +
          '<small><span class="qc-status-pill qc-status-' + esc(r.status) + '">' + esc(r.status) + "</span></small>" +
        "</div>" +
        '<div class="qc-sc-amt">' + fmt(r.total) + "</div>" +
        '<div class="qc-sc-actions">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-act="status" data-q="' + esc(r.quoteNo) + '" data-v="accepted">Accepted</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-act="status" data-q="' + esc(r.quoteNo) + '" data-v="declined">Declined</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-act="status" data-q="' + esc(r.quoteNo) + '" data-v="pending">Pending</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-act="copy" data-q="' + esc(r.quoteNo) + '">Copy</button>' +
          '<button class="btn btn-ghost btn-sm btn-danger" type="button" data-act="delete" data-q="' + esc(r.quoteNo) + '">Delete</button>' +
        "</div></div>";
    }).join("");
  }

  function handleSavedAction(e) {
    var btn = e.target.closest("button[data-act]");
    if (!btn) { return; }
    var quotes = safeGet(STORE_QUOTES, []);
    var no = btn.getAttribute("data-q");
    var act = btn.getAttribute("data-act");

    if (act === "delete") {
      if (!window.confirm("Delete quote " + no + " from this device? This cannot be undone.")) { return; }
      quotes = quotes.filter(function (r) { return r.quoteNo !== no; });
      safeSet(STORE_QUOTES, quotes);
      toast("Quote deleted");
    } else if (act === "status") {
      quotes.forEach(function (r) { if (r.quoteNo === no) { r.status = btn.getAttribute("data-v"); } });
      safeSet(STORE_QUOTES, quotes);
      toast("Status updated");
    } else if (act === "copy") {
      var found = quotes.filter(function (r) { return r.quoteNo === no; })[0];
      if (found) { copyText(found.itemized, "Quote"); }
      return;
    }
    renderSaved(); renderDashboard();
  }

  /* =========================================================
     DASHBOARD
     ========================================================= */
  function renderDashboard() {
    var quotes = safeGet(STORE_QUOTES, []);
    var accepted = quotes.filter(function (r) { return r.status === "accepted"; });
    var declined = quotes.filter(function (r) { return r.status === "declined"; });
    var pending  = quotes.filter(function (r) { return r.status === "pending"; });

    var quoted = quotes.reduce(function (a, r) { return a + r.total; }, 0);
    var deposits = quotes.reduce(function (a, r) { return a + (r.deposit || 0); }, 0);
    var balances = accepted.reduce(function (a, r) { return a + (r.balance || 0); }, 0);
    var avg = quotes.length ? quoted / quotes.length : 0;
    var conv = quotes.length ? (accepted.length / quotes.length) * 100 : 0;

    var byService = tally(quotes, "serviceLabel");
    var top = Object.keys(byService).sort(function (a, b) { return byService[b].n - byService[a].n; })[0];

    $("dashStats").innerHTML = [
      stat("Quotes created", quotes.length),
      stat("Accepted", accepted.length),
      stat("Declined", declined.length),
      stat("Pending", pending.length),
      stat("Estimated quoted revenue", fmt(quoted)),
      stat("Deposits collected", fmt(deposits)),
      stat("Remaining balances", fmt(balances), "Accepted quotes only"),
      stat("Average quote", fmt(avg)),
      stat("Conversion rate", conv.toFixed(0) + "%"),
      stat("Most requested", top || "No data yet")
    ].join("");

    $("dashByService").innerHTML = renderTally(byService) ||
      '<p class="qc-note qc-note-info">No saved quotes yet.</p>';
    $("dashBySource").innerHTML = renderTally(tally(quotes, "leadSource")) ||
      '<p class="qc-note qc-note-info">No lead sources recorded yet.</p>';
  }

  function tally(rows, key) {
    var out = {};
    rows.forEach(function (r) {
      var k = r[key] || "Not recorded";
      if (!out[k]) { out[k] = { n: 0, total: 0 }; }
      out[k].n++; out[k].total += r.total;
    });
    return out;
  }
  function renderTally(map) {
    var keys = Object.keys(map).sort(function (a, b) { return map[b].n - map[a].n; });
    if (!keys.length) { return ""; }
    return keys.map(function (k) {
      return '<div class="qc-savedcard"><div class="qc-sc-main"><strong>' + esc(k) +
        "</strong><small>" + map[k].n + " quote" + (map[k].n === 1 ? "" : "s") +
        '</small></div><div class="qc-sc-amt">' + fmt(map[k].total) + "</div></div>";
    }).join("");
  }
  function stat(label, value, sub) {
    return '<div class="qc-stat"><div class="qc-stat-label">' + esc(label) +
      '</div><div class="qc-stat-value">' + esc(value) + "</div>" +
      (sub ? '<div class="qc-stat-sub">' + esc(sub) + "</div>" : "") + "</div>";
  }

  /* =========================================================
     ADMIN PRICING PANEL
     ========================================================= */
  var ADMIN_SECTIONS = [
    ["Global rules", "rules"],
    ["Primary service prices", "services"],
    ["Appointment timing", "timing"],
    ["Urgency", "urgency"],
    ["Travel zones", "travel.zones"],
    ["Travel, other", "travel"],
    ["Documents, signers and acts", "quantities"],
    ["Location premiums", "locations"],
    ["Waiting time", "waiting"],
    ["Printing and document handling", "printing"],
    ["Witness services", "witness"],
    ["Apostille", "apostille"],
    ["Loan signing additions", "loan"],
    ["I-9 verification", "i9"],
    ["Discounts", "discounts"],
    ["Cancellation and return trips", "cancellation"],
    ["Deposit", "deposit"]
  ];

  function resolve(path) {
    var parts = path.split(".");
    var node = CFG;
    for (var i = 0; i < parts.length; i++) { node = node[parts[i]]; }
    return node;
  }

  var STATUS_ORDER = ["published_approved", "approved_internal", "proposed", "custom_required"];

  function statusPill(st) {
    var cls = { published_approved: "qc-src-live", approved_internal: "qc-src-derived",
                proposed: "qc-src-review", custom_required: "qc-src-gov" }[st] || "qc-src-gov";
    return '<span class="qc-src ' + cls + '">' +
           esc(CFG.STATUS_LABELS[st] || st) + "</span>";
  }

  function passesFilter(st, filter) {
    if (filter === "all") { return true; }
    if (filter === "needs_approval") { return st === "proposed"; }
    if (filter === "custom_required") { return st === "custom_required"; }
    if (filter === "approved") { return st === "approved_internal"; }
    if (filter === "published") { return st === "published_approved"; }
    return true;
  }

  function renderAdmin() {
    $("cfgVersion").value = CFG.meta.schedulePriceVersion;
    $("cfgEffective").value = CFG.meta.effectiveDate;
    $("cfgExpiry").value = CFG.meta.quoteExpirationDays;
    $("cfgHomeBase").value = CFG.meta.homeBase || "";
    $("cfgFirstAct").value = CFG.rules.statutoryFirstActTreatment || "";
    $("statutoryPolicyNotice").hidden = !!CFG.rules.statutoryFirstActTreatment;

    var filter = val("rateFilter") || "all";
    var html = "";
    var shown = 0;

    ADMIN_SECTIONS.forEach(function (sec) {
      var node = resolve(sec[1]);
      var rows = "";
      Object.keys(node).forEach(function (k) {
        var e = node[k];
        if (!e || typeof e !== "object" || Array.isArray(e)) { return; }
        if (e.label === undefined && e.base === undefined) { return; }

        var st = e.status || "custom_required";
        if (!passesFilter(st, filter)) { return; }
        shown++;

        var amountKey = (e.base !== undefined) ? "base" : "amount";
        var amount = e[amountKey];
        if (amount === undefined || amount === null) { amount = 0; }
        var label = e.label || k;
        var base = "cfg__" + sec[1].replace(/\./g, "_") + "__" + k;
        var dp = ' data-path="' + esc(sec[1]) + '" data-key="' + esc(k) + '"';

        rows += '<div class="qc-rate">' +
          '<label class="qc-rate-label" for="' + base + '">' + esc(label) + " " + statusPill(st) + "</label>" +
          '<input type="number" step="0.01" id="' + base + '" value="' + Number(amount) +
            '"' + dp + ' data-field="' + amountKey + '" inputmode="decimal">' +
          '<span class="qc-toggle"><input type="checkbox" ' + (e.enabled === false ? "" : "checked") +
            dp + ' data-field="enabled" aria-label="Enable ' + esc(label) + '"></span>' +
          "</div>";

        /* Second line: status, source, effective date, notes. */
        rows += '<div style="padding:0 0 .7rem;border-bottom:1px dashed var(--line);display:grid;' +
                'grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.4rem">' +
          '<select' + dp + ' data-field="status" aria-label="Pricing status for ' + esc(label) + '" ' +
            'style="font-size:.82rem;padding:.4rem;border:1.5px solid var(--line);border-radius:8px;min-height:40px">' +
            STATUS_ORDER.map(function (o) {
              return '<option value="' + o + '"' + (o === st ? " selected" : "") + ">" +
                     esc(CFG.STATUS_LABELS[o]) + "</option>";
            }).join("") +
          "</select>" +
          '<input type="text"' + dp + ' data-field="source" value="' + esc(e.source || "") +
            '" placeholder="Source" aria-label="Source for ' + esc(label) +
            '" style="font-size:.82rem;padding:.4rem;border:1.5px solid var(--line);border-radius:8px;min-height:40px;text-align:left">' +
          '<input type="date"' + dp + ' data-field="effectiveDate" value="' + esc(e.effectiveDate || "") +
            '" aria-label="Effective date for ' + esc(label) +
            '" style="font-size:.82rem;padding:.4rem;border:1.5px solid var(--line);border-radius:8px;min-height:40px">' +
          '<input type="text"' + dp + ' data-field="notes" value="' + esc(e.notes || "") +
            '" placeholder="Notes" aria-label="Notes for ' + esc(label) +
            '" style="font-size:.82rem;padding:.4rem;border:1.5px solid var(--line);border-radius:8px;min-height:40px;text-align:left">' +
          "</div>";

        if (e.tierBase !== undefined && e.tierBase !== null) {
          rows += '<div class="qc-rate"><label class="qc-rate-label" for="' + base + '__tier">' +
            "&nbsp;&nbsp;" + esc(label) + ' starting price (replaces the base)</label>' +
            '<input type="number" step="0.01" id="' + base + '__tier" value="' + Number(e.tierBase) +
              '"' + dp + ' data-field="tierBase" inputmode="decimal"><span class="qc-toggle"></span></div>';
        }

        if (e.pricingMode !== undefined) {
          rows += '<div class="qc-rate"><label class="qc-rate-label" for="' + base + '__mode">' +
            "&nbsp;&nbsp;How should this service be priced?</label>" +
            '<select id="' + base + '__mode"' + dp + ' data-field="pricingMode" ' +
            'style="grid-column:span 2;font-size:.85rem;padding:.5rem;border:1.5px solid var(--line);border-radius:8px;min-height:44px">' +
            ['<option value="use_general">Use the general mobile notary base price</option>',
             '<option value="separate">Use a separate approved price entered above</option>',
             '<option value="custom">Require a custom quote every time</option>'].join("").replace(
               'value="' + e.pricingMode + '"', 'value="' + e.pricingMode + '" selected') +
            "</select></div>";
        }
      });

      if (rows) {
        html += '<div class="qc-admin-group"><h3>' + esc(sec[0]) + "</h3>" + rows + "</div>";
      }
    });

    if (!shown) {
      html = '<p class="qc-note qc-note-info">No rates match that filter.</p>';
    }
    $("adminBody").innerHTML = html;

    var dHtml = "";
    Object.keys(CFG.disclaimers).forEach(function (k) {
      dHtml += '<div class="qc-field qc-full" style="margin-bottom:.9rem"><label for="disc__' + esc(k) + '">' +
        esc(k) + '</label><textarea id="disc__' + esc(k) + '" rows="3" data-disc="' + esc(k) + '">' +
        esc(CFG.disclaimers[k]) + "</textarea></div>";
    });
    $("adminDisclaimers").innerHTML = dHtml;

    $("adminLegal").innerHTML = '<ul style="padding-left:1.1rem">' +
      CFG.legalReviewFlags.map(function (f) { return '<li style="margin-bottom:.7rem">' + esc(f) + "</li>"; }).join("") +
      '</ul><p class="qc-note qc-note-warn">These are questions for you to verify with the Georgia ' +
      "Superior Court Clerks' Cooperative Authority, your attorney, or your accountant. They are not " +
      "confirmed statements of current law.</p>";
  }

  function saveAdmin() {
    CFG.meta.schedulePriceVersion = val("cfgVersion");
    CFG.meta.effectiveDate = val("cfgEffective");
    CFG.meta.quoteExpirationDays = Math.max(1, intVal("cfgExpiry"));
    CFG.meta.homeBase = val("cfgHomeBase");
    CFG.rules.statutoryFirstActTreatment = val("cfgFirstAct") || null;

    var inputs = $("adminBody").querySelectorAll("[data-path]");
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      var node = resolve(el.getAttribute("data-path"))[el.getAttribute("data-key")];
      var field = el.getAttribute("data-field");
      if (field === "enabled") { node.enabled = el.checked; }
      else if (field === "status" || field === "source" ||
               field === "effectiveDate" || field === "notes" || field === "pricingMode") {
        node[field] = el.value;
      } else {
        var v = parseFloat(el.value);
        node[field] = (isNaN(v) || !isFinite(v)) ? 0 : Math.round(v * 100) / 100;
      }
    }

    var discs = $("adminDisclaimers").querySelectorAll("[data-disc]");
    for (var j = 0; j < discs.length; j++) {
      CFG.disclaimers[discs[j].getAttribute("data-disc")] = discs[j].value;
    }

    if (safeSet(STORE_CONFIG, CFG)) {
      toast("Pricing settings saved");
      buildSelects();
      renderAdmin();
      recalc();
    }
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* =========================================================
     FORM BEHAVIOUR
     ========================================================= */
  var LAST_SERVICE_KEY = null;

  /* syncVisibility never runs on plain typing. It runs only when a
     select, checkbox or radio changes, and it only forces an accordion
     open or closed when the SERVICE selection itself changed. Forcing
     .open on every keystroke was collapsing the section being typed in. */
  function syncVisibility(opts) {
    var svcKey = val("service");
    var svc = CFG.services[svcKey] || {};
    var serviceChanged = (svcKey !== LAST_SERVICE_KEY);
    var allowToggles = !(opts && opts.typingOnly);

    $("customServiceWrap").hidden = !(svc.status === "custom_required" || svc.pricingMode === "custom");
    $("customServiceLabelWrap").hidden = !(svcKey === "custom_service");

    if (serviceChanged && allowToggles) {
      $("loanSection").open = !!svc.loan;
      $("i9Section").open = svcKey === "i9";
      $("apostilleSection").open = svcKey.indexOf("apostille") === 0;
      if (svcKey.indexOf("apostille") === 0 && !checked("apInclude")) { $("apInclude").checked = true; }
      LAST_SERVICE_KEY = svcKey;
    }

    var mode = val("travelMode");
    $("zoneWrap").hidden = mode !== "zone";
    $("milesWrap").hidden = mode !== "miles";
    $("customTravelWrap").hidden = mode !== "custom";
    $("travelMeasurement").disabled = (mode === "miles");

    if (allowToggles) {
      /* Attorney supervision checkboxes are mutually exclusive. */
      if (checked("loanConfirmed") && checked("loanPending")) { $("loanPending").checked = false; }
      /* Witness helpers. */
      if (checked("witClientProvides") && intVal("cntWitnessProv") > 0) {
        $("witClientProvides").checked = false;
      }
    }

    var hint = $("serviceHint");
    var stLabel = CFG.STATUS_LABELS[svc.status] || svc.status || "";
    if (svc.pricingMode === "use_general" && svc.aliasOf && CFG.services[svc.aliasOf]) {
      var al = CFG.services[svc.aliasOf];
      hint.textContent = "Priced at the " + al.label.toLowerCase() + " rate of " + fmt(al.base) +
                         ". Change this in Pricing Settings if it should be priced separately.";
    } else if (svc.status === "custom_required" || svc.pricingMode === "custom") {
      hint.textContent = "Custom quote required. Enter an amount for this appointment or approve a rate in Pricing Settings.";
    } else {
      hint.textContent = "Starting at " + fmt(svc.base) + ". " + stLabel + ". Source: " + (svc.source || "not recorded") + ".";
    }
  }

  function setupSteppers() {
    document.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-step]");
      if (!b) { return; }
      var input = $(b.getAttribute("data-step"));
      if (!input) { return; }
      var dir = parseInt(b.getAttribute("data-dir"), 10);
      var min = input.hasAttribute("min") ? parseFloat(input.getAttribute("min")) : 0;
      var next = (parseFloat(input.value) || 0) + dir;
      if (next < min) { next = min; }
      input.value = next;
      recalc();
    });
  }

  function setupTabs() {
    var tabs = [["tabQuote", "panelQuote"], ["tabSaved", "panelSaved"],
                ["tabDashboard", "panelDashboard"], ["tabAdmin", "panelAdmin"]];
    tabs.forEach(function (pair) {
      $(pair[0]).addEventListener("click", function () {
        tabs.forEach(function (p) {
          var isMe = p[0] === pair[0];
          $(p[0]).setAttribute("aria-selected", isMe ? "true" : "false");
          $(p[1]).hidden = !isMe;
        });
        if (pair[0] === "tabSaved") { renderSaved(); }
        if (pair[0] === "tabDashboard") { renderDashboard(); }
        if (pair[0] === "tabAdmin") { renderAdmin(); }
        window.scrollTo({ top: 0, behavior: "auto" });
      });
    });
  }

  function resetForm() {
    if (!window.confirm("Clear this quote and start a new one?")) { return; }
    $("qcForm").reset();
    CURRENT_QUOTE_NO = null;
    CURRENT_CREATED = null;
    CUSTOM_RATES = {};
    LAST_SERVICE_KEY = null;
    LAST_INCOMPLETE_SIG = null;
    $("travelMeasurement").value = CFG.travel.measurement;
    $("waitIncluded").value = CFG.rules.includedMinutes.amount;
    syncVisibility();
    recalc();
    toast("Form reset");
  }

  function duplicateQuote() {
    CURRENT_QUOTE_NO = null;
    CURRENT_CREATED = null;
    recalc();
    toast("Duplicated as " + CURRENT_QUOTE_NO);
  }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    if (!window.PRICING_CONFIG || !window.QuoteEngine) {
      document.getElementById("qcResult").innerHTML =
        '<p class="qc-note qc-note-legal">The pricing configuration did not load. ' +
        "Check that pricing-config.js and quote-engine.js are present in assets/js.</p>";
      return;
    }

    loadConfig();
    buildSelects();
    syncVisibility();

    /* Recalculate on any change, throttled so typing stays smooth. */
    var timer = null;
    function schedule(typingOnly) {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        syncVisibility({ typingOnly: !!typingOnly });
        recalc();
      }, typingOnly ? 250 : 90);
    }

    /* Typing only recalculates. It never re-evaluates accordion state. */
    $("qcForm").addEventListener("input", function () { schedule(true); });

    /* A select, checkbox or radio change may legitimately open or close
       a section, so those get the full visibility pass. */
    $("qcForm").addEventListener("change", function (e) {
      var t = e.target;
      var structural = t && (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "radio");
      schedule(!structural);
    });

    setupSteppers();
    setupTabs();

    $("btnRecalc").addEventListener("click", recalc);
    $("btnSave").addEventListener("click", saveQuote);
    $("btnReset").addEventListener("click", resetForm);
    $("btnDuplicate").addEventListener("click", duplicateQuote);
    $("btnPrint").addEventListener("click", function () { window.print(); });
    $("btnCopyTotal").addEventListener("click", function () {
      copyText(LAST && !LAST.blocked ? fmt(LAST.totals.estimatedTotal) : "Quote on hold", "Total");
    });
    $("btnCopyItemized").addEventListener("click", function () { copyText(buildItemized(LAST), "Itemized quote"); });
    $("btnCopyText").addEventListener("click", function () { copyText(buildTextMessage(LAST), "Text message"); });
    $("btnStickyCopy").addEventListener("click", function () { copyText(buildTextMessage(LAST), "Text message"); });
    $("btnCopyEmail").addEventListener("click", function () { copyText(buildEmail(LAST), "Email"); });

    $("searchSaved").addEventListener("input", renderSaved);
    $("savedList").addEventListener("click", handleSavedAction);
    $("btnExportQuotes").addEventListener("click", function () {
      download("anytime-anywhere-quotes-" + new Date().toISOString().slice(0, 10) + ".json",
               JSON.stringify(safeGet(STORE_QUOTES, []), null, 2));
      toast("Quotes exported");
    });
    $("btnClearQuotes").addEventListener("click", function () {
      if (!window.confirm("Delete every saved quote on this device? This cannot be undone. Export a backup first.")) { return; }
      safeSet(STORE_QUOTES, []);
      renderSaved(); renderDashboard();
      toast("All stored quotes cleared");
    });

    $("rateFilter").addEventListener("change", renderAdmin);
    $("cfgFirstAct").addEventListener("change", function () {
      $("statutoryPolicyNotice").hidden = !!val("cfgFirstAct");
    });

    /* Typing an amount for a blocked item applies to THIS quote only.
       It never changes your saved rate sheet. */
    $("qcIncomplete").addEventListener("input", function (e) {
      var el = e.target.closest ? e.target.closest("[data-customrate]") : null;
      if (!el) { return; }
      var path = el.getAttribute("data-customrate");
      var v = el.value;
      if (v === "" || isNaN(parseFloat(v))) { delete CUSTOM_RATES[path]; }
      else { CUSTOM_RATES[path] = parseFloat(v); }
      window.clearTimeout(window._crTimer);
      window._crTimer = window.setTimeout(recalc, 300);
    });

    $("btnSaveConfig").addEventListener("click", saveAdmin);
    $("btnExportConfig").addEventListener("click", function () {
      saveAdmin();
      download("anytime-anywhere-pricing-" + CFG.meta.effectiveDate + ".json", JSON.stringify(CFG, null, 2));
      toast("Pricing exported");
    });
    $("btnImportConfig").addEventListener("click", function () { $("importFile").click(); });
    $("importFile").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) { return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(reader.result);
          CFG = mergeConfig(deepClone(window.PRICING_CONFIG), parsed);
          safeSet(STORE_CONFIG, CFG);
          buildSelects(); renderAdmin(); recalc();
          toast("Pricing imported");
        } catch (err) { toast("That file is not valid pricing JSON."); }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
    $("btnResetConfig").addEventListener("click", function () {
      if (!window.confirm("Restore the shipped default pricing and discard your edits?")) { return; }
      try { window.localStorage.removeItem(STORE_CONFIG); } catch (err) { /* ignore */ }
      loadConfig(); buildSelects(); renderAdmin(); recalc();
      toast("Shipped defaults restored");
    });

    recalc();
    renderSaved();
    renderDashboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }

})();
