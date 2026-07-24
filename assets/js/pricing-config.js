/* ===========================================================
   Anytime Anywhere Mobile Notary Services LLC
   PRICING CONFIGURATION, single source of truth

   Schedule 3.0, approved 2026-07-23.

   STATUS VALUES
     "published_approved"  on your live pricing page
     "approved_internal"   approved by you, not published
     "proposed"            awaiting approval, internal estimate only
     "custom_required"     blocked until you enter an amount

   Only published_approved and approved_internal can create a
   client ready total. Genuinely variable outside costs are
   approved_internal at $0 and require an amount to be typed
   when the matching option is selected.
   =========================================================== */

(function (root) {
  "use strict";

  var PUB = "published_approved", APPR = "approved_internal",
      PROP = "proposed", CUSTOM = "custom_required";
  var LIVE = "2026-07-23";

  function R(label, amount, status, source, notes, extra) {
    var o = { label: label, amount: amount, enabled: true, status: status,
              source: source || "", effectiveDate: LIVE, notes: notes || "" };
    if (status === CUSTOM || status === PROP) { o.effectiveDate = ""; }
    if (extra) { Object.keys(extra).forEach(function (k) { o[k] = extra[k]; }); }
    return o;
  }
  function SVC(label, base, status, source, notes, extra) {
    var o = R(label, base, status, source, notes, extra);
    o.base = base; delete o.amount;
    if (o.timingFloor === undefined) { o.timingFloor = true; }
    return o;
  }

  var LP = "Live pricing page, pricing.html";
  var AP = "Approved rate schedule 3.0";
  var MANUAL = "Variable outside cost, entered per appointment";
  var NOTSET = "No approved amount";

  var CONFIG = {

    meta: {
      business: "Anytime Anywhere Mobile Notary Services LLC",
      shortName: "Anytime Anywhere Mobile Notary",
      phone: "720-400-1522",
      email: "malika@anytimenotarize.com",
      website: "https://anytimenotarize.com",
      serviceArea: "Metro Atlanta, Georgia",
      logo: "assets/images/logo-hero.png",
      schedulePriceVersion: "3.2",
      effectiveDate: LIVE,
      quoteExpirationDays: 7,
      quotePrefix: "AAN",
      homeBase: ""
    },

    /* ---------------- GLOBAL RULES ---------------- */
    rules: {
      timingTierActsAsFloor: true,

      /* The $65 base already contains the first notarial act. */
      statutoryFirstActTreatment: "included",

      minimumTripCharge: R("Minimum trip charge", 65, APPR, AP,
        "Matches the standard weekday base."),

      statutoryActFee: R("Georgia notarial act fee (per act)", 2, PUB, LP,
        "First act is inside the base. Each additional act is $2."),

      includedMinutes: R("Included appointment time (minutes)", 15, PUB, LP,
        "Waiting time starts after this."),

      includedActs: R("Notarial acts included in base", 1, PUB, LP, ""),

      tax: R("Tax rate (percent)", 0, CUSTOM, "Not determined",
        "Off. Confirm with your accountant.", { enabled: false }),

      cardAdjustment: R("Card processing adjustment (percent)", 0, CUSTOM, "Not determined",
        "Off. Confirm card network rules first.", { enabled: false })
    },

    /* ---------------- SERVICES ---------------- */
    services: {
      general_mobile: SVC("General mobile notarization", 65, PUB, LP,
        "Includes the first notarial act, up to 15 one way miles, and up to 15 minutes."),

      estate_docs: SVC("Estate document appointment", 0, APPR,
        "Uses the general mobile notarization price", "Priced at the general mobile base.",
        { pricingMode: "use_general", aliasOf: "general_mobile" }),
      poa: SVC("Power of attorney appointment", 0, APPR,
        "Uses the general mobile notarization price", "Priced at the general mobile base.",
        { pricingMode: "use_general", aliasOf: "general_mobile" }),
      business_docs: SVC("Business document notarization", 0, APPR,
        "Uses the general mobile notarization price", "Priced at the general mobile base.",
        { pricingMode: "use_general", aliasOf: "general_mobile" }),

      hospital:        SVC("Hospital notarization", 125, PUB, LP, "Includes first act and 15 included miles."),
      nursing_home:    SVC("Nursing home notarization", 125, PUB, LP, "Includes first act and 15 included miles."),
      assisted_living: SVC("Assisted living notarization", 125, PUB, LP, "Includes first act and 15 included miles."),
      hospice:         SVC("Hospice or bedside notarization", 125, PUB, LP, "Includes first act and 15 included miles."),
      rehab_facility:  SVC("Rehabilitation facility notarization", 125, PUB, LP, "Includes first act and 15 included miles."),

      jail_visit:      SVC("Jail or detention center visit", 150, APPR, AP,
                          "Includes first act and 15 included miles."),

      i9:              SVC("I-9 authorized representative", 75, PUB, LP,
                          "First employee. Portal upload included."),

      apostille:       SVC("Apostille facilitation", 125, PUB, LP,
                          "Covers the first document. Government fees are separate.",
                          { timingFloor: false }),
      apostille_pickup:  SVC("Apostille document pickup", 40, APPR, AP,
                            "Within the 15 mile included area.", { timingFloor: false }),
      apostille_courier: SVC("Apostille courier or return delivery", 40, APPR, AP,
                            "Within the 15 mile included area.", { timingFloor: false }),

      loan_refinance:    SVC("Refinance package", 125, PUB, LP, "", { timingFloor: false, loan: true }),
      loan_buyer:        SVC("Buyer or purchase package", 150, PUB, LP, "", { timingFloor: false, loan: true }),
      loan_seller:       SVC("Seller package", 0, CUSTOM,
                            "Purchase package published, seller not separated", "",
                            { timingFloor: false, loan: true }),
      loan_heloc:        SVC("HELOC package", 125, PUB, LP, "", { timingFloor: false, loan: true }),
      loan_reverse:      SVC("Reverse mortgage package", 175, PUB, LP, "", { timingFloor: false, loan: true }),
      loan_modification: SVC("Loan modification", 0, CUSTOM, NOTSET, "", { timingFloor: false, loan: true }),
      loan_commercial:   SVC("Commercial or complex package", 0, CUSTOM,
                            "Your page states custom quote", "", { timingFloor: false, loan: true }),

      courier_only:    SVC("Print and deliver or courier only", 40, APPR, AP,
                          "Separate courier only drop off, plus excess mileage.", { timingFloor: false }),
      witness_only:    SVC("Witness only service", 0, CUSTOM, NOTSET, ""),
      pickup_delivery: SVC("Document pickup or delivery", 40, APPR, AP,
                          "Within the 15 mile included area, plus excess mileage.", { timingFloor: false }),
      custom_service:  SVC("Other or custom service", 0, CUSTOM,
                          "Priced per appointment", "", { timingFloor: false })
    },

    /* ---------------- TIMING ----------------
       tierBase values are MINIMUM BASE replacements. The
       highest applicable minimum wins. They are never added
       on top of each other or on top of the service base. */
    timing: {
      standard:      R("Standard weekday business hours", 0, PUB, LP, "No premium.",
                       { tierBase: null, premium: 0 }),
      early_morning: R("Early morning, 6:00 a.m. through 8:00 a.m.", 0, APPR, AP,
                       "Minimum base becomes $85.00.",
                       { tierBase: 85, premium: 0 }),
      evening:       R("Evening", 0, PUB, LP, "Minimum base becomes $85.",
                       { tierBase: 85, premium: 0 }),
      saturday:      R("Saturday", 0, PUB, LP, "Minimum base becomes $95.",
                       { tierBase: 95, premium: 0 }),
      sunday:        R("Sunday", 0, PUB, LP, "Minimum base becomes $95.",
                       { tierBase: 95, premium: 0 }),
      holiday:       R("Holiday", 0, APPR, AP, "Minimum base becomes $125.",
                       { tierBase: 125, premium: 0 }),
      late_night:    R("Late night, after 10 p.m.", 0, APPR, AP, "Minimum base becomes $125.",
                       { tierBase: 125, premium: 0 }),
      overnight:     R("Overnight, 12:00 a.m. through 5:59 a.m.", 0, APPR, AP, "Minimum base becomes $150.",
                       { tierBase: 150, premium: 0 }),
      custom_timing: R("Custom timing fee", 0, CUSTOM, "Priced per appointment", "",
                       { tierBase: null, premium: 0 })
    },

    /* Urgency premiums ARE added on top of the minimum base. */
    urgency: {
      scheduled:  R("Scheduled appointment", 0, PUB, LP, "No premium."),
      same_day:   R("Same day, more than two hours notice", 25, APPR, AP, "Added on top of the base."),
      rush:       R("Rush, two hours or less notice", 40, APPR, AP, "Added on top of the base."),
      within_two: R("Requested within two hours", 40, APPR, AP, "Same as rush."),
      emergency:  R("Emergency, immediate dispatch or arrival within one hour", 60, APPR, AP,
                    "Added on top of the base. Urgency premiums never stack, only the highest applies.")
    },

    /* ---------------- TRAVEL ----------------
       Distance is measured ONE WAY from your stored starting
       location. The first 15 one way miles are included.
       Every mile beyond that is $2. */
    travel: {
      measurement: "one_way",
      perMileRate:   R("Per additional one way mile", 2, APPR, AP,
                       "Applies to each one way mile beyond the included 15."),
      includedMiles: R("Included one way miles", 15, APPR, AP,
                       "Inside the base price of every appointment."),
      longDistanceThreshold: R("Long distance notice threshold (one way miles)", 50, APPR, AP,
                       "Beyond this the quote still calculates but shows an availability notice."),
      returnTrip:    R("Client caused return trip service charge", 35, APPR, AP,
                       "Charged in addition to a fresh automatic travel calculation."),
      additionalStop: R("Additional destination or stop", 0, CUSTOM, NOTSET, ""),

      /* RETIRED in schedule 3.2. The exact one way mileage field is
         now the only travel calculation method, so these ranges are
         disabled. Their amounts are left untouched for reference.
         Each range charged the top of its band, which overcharged a
         16 mile trip by $8. */
      zones: {
        local:    R("Local, within the included 15 one way miles", 0, APPR, AP, "Included.",
                    { enabled: false, retired: true }),
        z0_10:    R("0 to 10 one way miles", 0, APPR, AP, "Inside the included 15 miles.", { enabled: false, retired: true }),
        z11_15:   R("11 to 15 one way miles", 0, APPR, AP, "Inside the included 15 miles.", { enabled: false, retired: true }),
        z16_20:   R("16 to 20 one way miles", 10, APPR, AP, "5 excess miles at $2.", { enabled: false, retired: true }),
        z21_30:   R("21 to 30 one way miles", 30, APPR, AP, "15 excess miles at $2.", { enabled: false, retired: true }),
        z31_40:   R("31 to 40 one way miles", 50, APPR, AP, "25 excess miles at $2.", { enabled: false, retired: true }),
        z41_50:   R("41 to 50 one way miles", 70, APPR, AP, "35 excess miles at $2.", { enabled: false, retired: true }),
        z50_plus: R("More than 50 one way miles", 0, CUSTOM,
                    "Use the mileage field for an exact figure", "Confirm availability first.", { enabled: false, retired: true }, { enabled: false, retired: true }),
        custom:   R("Custom travel fee", 0, CUSTOM, "Priced per appointment", "",
                    { enabled: false, retired: true })
      }
    },

    passthrough: {
      parking: R("Parking", 0, APPR, MANUAL, "Pass through reimbursement.", { enabled: false, retired: true }),
      tolls:   R("Tolls", 0, APPR, MANUAL, "Pass through reimbursement."),
      valet:   R("Valet", 0, APPR, MANUAL, "Pass through reimbursement.")
    },

    /* ---------------- COUNTS ----------------
       No automatic charge for another document or another
       signer. Only an actual additional notarial act is
       billed, at the $2 statutory rate. */
    quantities: {
      additionalAct:      R("Additional notarial act, service charge", 0, APPR, AP,
                            "Intentional zero. Additional acts bill at the $2 statutory fee only."),
      additionalSigner:   R("Additional signer", 0, APPR, AP,
                            "Intentional zero. Signers are not billed separately."),
      additionalDocument: R("Additional document", 0, APPR, AP,
                            "Intentional zero. Documents are not billed separately.")
    },

    /* ---------------- LOCATIONS ----------------
       tierBase is a minimum base replacement, same rule as
       timing. amount stays 0 so nothing is ever added twice. */
    locations: (function () {
      var inc = "Intentional zero. Facility pricing is carried in the service base.";
      var src = "No separate location premium";
      var defs = [
        ["residence", "Private residence", null], ["business", "Business or office", null],
        ["hospital", "Hospital", null], ["nursing_home", "Nursing home", null],
        ["assisted_living", "Assisted living facility", null], ["hospice", "Hospice", null],
        ["rehab", "Rehabilitation facility", null], ["senior_community", "Senior community", null],
        ["jail", "Jail or detention facility", 150], ["courthouse", "Courthouse", null],
        ["attorney_office", "Attorney's office", null], ["title_office", "Title or closing office", null],
        ["airport", "Airport", 125], ["hotel", "Hotel", null],
        ["public_meeting", "Restaurant or public meeting place", null], ["other_location", "Other", null]
      ];
      var out = {};
      defs.forEach(function (d) {
        out[d[0]] = R(d[1], 0, APPR, d[2] ? AP : src,
          d[2] ? "Minimum base becomes $" + d[2] + ".00." : inc, { tierBase: d[2] });
      });
      return out;
    })(),

    /* ---------------- WAITING ---------------- */
    waiting: {
      per15:       R("Each additional 15 minutes", 25, APPR, AP,
                     "Begins after the included 15 minutes."),
      per30:       R("Each additional 30 minutes", 0, APPR, AP,
                     "Intentional zero. Waiting bills in 15 minute increments.", { enabled: false }),
      customDelay: R("Custom delay fee", 0, CUSTOM, "Priced per appointment", "")
    },

    /* ---------------- PRINTING ----------------
       Tiered, not per page. Pick a printing type in the quote
       form and enter the page count. */
    printing: {
      generalBase:          R("General printing, first 20 pages", 10, APPR, AP, "Flat charge."),
      generalIncludedPages: R("General printing, pages included in the base charge", 20, APPR, AP, ""),
      generalOverPage:      R("General printing, each page over 20", 0.25, APPR, AP, ""),

      loanOneSet:           R("Loan package, one printed set up to 150 pages", 25, APPR, AP, ""),
      loanTwoSets:          R("Loan package, signing set plus borrower copy up to 150 pages each", 40, APPR, AP, ""),
      loanIncludedPages:    R("Loan package, pages included per set", 150, APPR, AP, ""),
      loanOverPage:         R("Loan package, each page beyond 150 per set", 0.25, APPR, AP, ""),

      scanbackThreshold:    R("Scanback tier threshold (pages)", 50, APPR, AP, ""),
      scanbackUpTo:         R("Scanbacks, up to 50 pages", 15, APPR, AP, ""),
      scanbackOver:         R("Scanbacks, over 50 pages", 25, APPR, AP, ""),
      faxbacks:             R("Faxbacks", 15, APPR, AP, ""),

      shippingLabel:  R("Shipping label printing", 0, APPR, AP, "Included."),
      carrierDropOff: R("Standard carrier drop off after a loan signing", 0, APPR, AP, "Included."),
      courierOnly:    R("Separate courier only drop off", 40, APPR, AP, "Plus excess mileage."),

      emailDocs:      R("Email completed documents", 0, APPR, AP, "Included."),
      packaging:      R("Document packaging", 0, APPR, AP, "Included."),
      docPickup:      R("Document pickup", 40, APPR, AP, "Within the included area, plus excess mileage."),
      docReturn:      R("Document return", 40, APPR, AP, "Within the included area, plus excess mileage."),
      courierStop:    R("Additional courier stop", 40, APPR, AP, "Plus excess mileage."),
      customHandling: R("Custom document handling", 0, CUSTOM, "Priced per appointment", "")
    },

    /* ---------------- WITNESSES ---------------- */
    witness: {
      coordination:  R("Witness coordination, per appointment", 25, APPR, AP, ""),
      perWitness:    R("Witness appearance, each witness", 40, APPR, AP, ""),
      clientProvides: R("Client provides witness", 0, APPR, AP, "No charge."),
      facilityProvides: R("Facility provides witness", 0, APPR, AP, "No charge."),
      customWitness: R("Custom witness charge", 0, CUSTOM, "Priced per appointment", "")
    },

    /* ---------------- APOSTILLE ---------------- */
    apostille: {
      facilitationFirst: R("Facilitation, first document", 125, PUB, LP, ""),
      facilitationAddl:  R("Facilitation, each additional document in the same order", 50, PUB, LP, ""),

      pickup:          R("Document pickup, within the included area", 40, APPR, AP, ""),
      dropoff:         R("Return delivery, within the included area", 40, APPR, AP, ""),
      pickupAndReturn: R("Pickup and return delivery together, within the included area", 70, APPR, AP,
                         "Replaces the separate $40 plus $40 charges."),
      rushHandling:    R("Rush apostille courier handling", 40, APPR, AP, ""),

      notarizeBefore:  R("Notarization required before processing", 0, APPR, AP,
                         "Billed as a notarial act on the appointment, not separately here."),

      govGsccca:    R("GSCCCA apostille, per document (Hague)", 3, PUB,
                      "Georgia Superior Court Clerks' Cooperative Authority published fee",
                      "Government fee, pass through."),
      govGreatSeal: R("Georgia Great Seal certification, per document (non Hague)", 10, PUB,
                      "Georgia Secretary of State published fee", "Government fee, pass through."),
      govFederal:   R("US Department of State authentication, per document", 20, PUB,
                      "US Department of State published fee", "Government fee, pass through."),

      /* Genuinely variable. An amount must be entered when selected. */
      certifiedCopy: R("Certified copies", 0, APPR, MANUAL, "Enter the cost when selected."),
      translation:   R("Translation", 0, APPR, MANUAL, "Enter the cost when selected."),
      countyAuth:    R("County authentication", 0, APPR, MANUAL, "Varies by county."),
      embassy:       R("Embassy or consulate legalization", 0, APPR, MANUAL, "Varies by country."),
      shipping:      R("Shipping", 0, APPR, MANUAL, "Domestic or international."),
      courier:       R("Outside courier", 0, APPR, MANUAL, ""),
      thirdParty:    R("Other third party or government cost", 0, APPR, MANUAL, "")
    },

    /* ---------------- LOAN ADDITIONS ---------------- */
    loan: {
      additionalSigner:   R("Additional signer", 0, APPR, AP, "Intentional zero."),
      additionalProperty: R("Additional property", 0, CUSTOM, NOTSET, ""),
      sellerBuyerCombo:   R("Seller and buyer combination", 0, CUSTOM, NOTSET, ""),
      trustOrPoa:         R("Trust or power of attorney documents", 0, APPR, AP, "Intentional zero."),
      faxbacks:           R("Faxbacks", 15, APPR, AP, ""),
      noPrintDiscount:    R("No print assignment adjustment", 0, APPR, AP, "Intentional zero."),
      resignReturn:       R("Hiring company caused loan re-sign", 0, CUSTOM,
                            "Custom quote required", "Quote each re-sign individually."),
      negotiated:         R("Custom negotiated fee", 0, CUSTOM, "Priced per assignment", "")
    },

    /* ---------------- I-9 ---------------- */
    i9: {
      additionalSameSite: R("Each additional employee, same location and same visit", 35, APPR, AP, ""),
      separateLocation:   R("Employee at a different address", 0, APPR, AP,
                            "Quote a different address as a separate appointment."),
      portalHandling:     R("Employer portal upload", 0, APPR, AP, "Included."),
      documentUpload:     R("Document upload", 0, APPR, AP, "Included."),
      printing:           R("Printing", 0, APPR, AP, "Use the printing schedule instead."),
      rush:               R("Same day or rush", 0, APPR, AP, "Use the urgency options instead."),
      businessRate:       R("Custom business account rate", 0, CUSTOM, NOTSET, "", { enabled: false })
    },

    /* ---------------- DISCOUNTS ---------------- */
    discounts: {
      promotional:  R("Promotional discount", 0, CUSTOM, NOTSET, ""),
      referral:     R("Referral discount", 0, CUSTOM, NOTSET, ""),
      repeatClient: R("Repeat client discount", 0, CUSTOM, NOTSET, ""),
      partnerRate:  R("Partner or preferred vendor rate", 0, CUSTOM, NOTSET, ""),
      multiAppt:    R("Multiple appointments, same location", 0, CUSTOM, NOTSET, ""),
      multiSigner:  R("Multiple signers, same location", 0, CUSTOM, NOTSET, ""),
      courtesy:     R("Courtesy adjustment", 0, CUSTOM, "Priced per appointment", "")
    },

    /* ---------------- CANCELLATION ----------------
       mode "flat"      charge the amount
       mode "full_base" charge the applicable appointment base
                        plus excess mileage, parking and tolls
       mode "none"      no charge
       No notarial act fee is ever charged on a failed
       appointment, because no act was performed. */
    cancellation: {
      before_dispatch:    R("Cancellation before dispatch", 0, APPR, AP, "No charge.", { mode: "none" }),
      after_dispatch:     R("Cancellation after dispatch but before arrival", 40, APPR, AP,
                            "Plus parking and tolls already incurred.", { mode: "flat" }),
      client_unavailable: R("No show after arrival", 0, APPR, AP,
                            "Full applicable base plus excess mileage, parking and tolls.", { mode: "full_base" }),
      no_valid_id:        R("Signer lacks acceptable identification after arrival", 0, APPR, AP,
                            "Full applicable base plus excess mileage, parking and tolls.", { mode: "full_base" }),
      unwilling:          R("Signer refuses or is unable to proceed after arrival", 0, APPR, AP,
                            "Full applicable base plus excess mileage, parking and tolls.", { mode: "full_base" }),
      not_aware:          R("Signer does not appear aware or willing after arrival", 0, APPR, AP,
                            "Full applicable base plus excess mileage, parking and tolls.", { mode: "full_base" }),
      facility_refused:   R("Facility denies access after arrival", 0, APPR, AP,
                            "Full applicable base plus excess mileage, parking and tolls.", { mode: "full_base" }),
      incomplete_doc:     R("Document incomplete after arrival", 0, APPR, AP,
                            "Full applicable base plus excess mileage, parking and tolls.", { mode: "full_base" }),
      rescheduled:        R("Appointment rescheduled before dispatch", 0, APPR, AP, "No charge.", { mode: "none" }),
      return_trip:        R("Client caused return trip", 35, APPR, AP,
                            "Service charge plus a fresh automatic travel calculation.", { mode: "flat" }),
      resign_client:      R("Re-sign caused by client", 35, APPR, AP,
                            "Service charge plus a fresh automatic travel calculation.", { mode: "flat" }),
      resign_company:     R("Re-sign caused by hiring company", 0, CUSTOM,
                            "Custom quote required", "Quote each one individually.", { mode: "flat" }),
      cannot_perform:     R("Notary caused correction or return", 0, APPR, AP, "No charge.", { mode: "none" }),
      custom_cancel:      R("Custom cancellation or trip fee", 0, CUSTOM, "Priced per appointment", "",
                            { mode: "flat" })
    },

    deposit: {
      defaultAmount: R("Standard deposit amount", 0, CUSTOM, NOTSET, "", { enabled: false })
    },

    /* ---------------- TEXT ---------------- */
    disclaimers: {
      estimate: "This quote is an estimate based on the information provided by the customer. The price may change if distance, document count, signer count, waiting time, printing, witnesses, location, or assignment requirements change.",
      notarial: "Notarization is subject to satisfactory identification, signer presence, willingness, awareness, document completeness, and all applicable Georgia law. A quote does not guarantee that a document can lawfully be notarized.",
      notLegal: "Anytime Anywhere Mobile Notary Services LLC is not a law firm and does not provide legal advice. The notary cannot select documents, prepare legal documents, explain the legal effect of a document, or decide which notarial certificate a signer needs.",
      apostille: "Apostille and authentication processing times are estimates and may be affected by government agencies, holidays, document condition, destination country requirements, and shipping providers. Not every document is eligible for an apostille. Government, embassy, shipping, and third party costs are pass through amounts and are not fees of this business.",
      loan: "Georgia is an attorney closing state. Real estate loan signings are completed only through an appropriate attorney supervised process where legally permitted. This quote does not authorize an independent real estate closing.",
      i9: "For I-9 appointments the notary acts as the employer's designated authorized representative. This is not a notarization unless a separate document specifically requires a notarial act.",
      witness: "Witness availability is not guaranteed until confirmed.",
      longDistance: "Long-distance appointment. Confirm availability before accepting.",
      finalPricing: "Final pricing is disclosed and accepted before services are performed."
    },

    checklist: [
      "All signers must be present.",
      "Signers must have acceptable, unexpired identification.",
      "Documents should be complete but unsigned unless you are instructed otherwise.",
      "Signers must be willing and aware.",
      "Witnesses must meet applicable requirements.",
      "Payment is due according to the stated terms.",
      "Facility access must be arranged in advance.",
      "The notary cannot choose the notarial certificate or provide legal advice.",
      "The notary may decline the appointment when lawful requirements are not met."
    ],

    paymentMethods: ["Cash", "Zelle", "Cash App", "Card", "Square invoice",
                     "Business check", "ACH", "Invoice account", "Other"],
    paymentTerms: ["Payment due before travel", "Payment due at appointment",
                   "Net 15 (approved business clients)", "Net 30 (approved business clients)"],

    legalReviewFlags: [
      "Georgia notarial fee: O.C.G.A. 45-17-11 sets $2.00 for the act and separately allows $2.00 for an attendance to make proof and certify, up to $4.00 for each service performed. This calculator charges only the $2.00 act fee. Confirm with GSCCCA whether you ever intend to charge the attendance fee.",
      "Georgia journal requirement: since January 1, 2025, Georgia notaries must keep a journal entry for each notarial act performed at the request of a self-filer under House Bill 1292.",
      "Remote online notarization: Georgia had no permanent RON law as of early 2026, and RON legislation was moving through the 2026 General Assembly session. Verify current status before advertising remote notarization.",
      "Attorney closing requirement: Georgia authorities have held that a non-attorney presiding over the execution of real estate conveyance documents can constitute the unauthorized practice of law. Confirm the supervision arrangement in writing for every loan signing.",
      "Tax: sales tax is off by default. Confirm applicability with your accountant.",
      "Card surcharging: the card processing adjustment is off by default. Confirm card network rules and Georgia law.",
      "Urgency premiums do not stack. Only the highest applicable premium is charged: same day $25, rush $40, emergency $60."
    ],

    STATUS: { PUB: PUB, APPR: APPR, PROP: PROP, CUSTOM: CUSTOM },
    STATUS_LABELS: {
      published_approved: "Published and approved",
      approved_internal:  "Approved internal rate",
      proposed:           "Proposed and awaiting approval",
      custom_required:    "Custom quote required"
    }
  };

  if (typeof module !== "undefined" && module.exports) { module.exports = CONFIG; }
  root.PRICING_CONFIG = CONFIG;

})(typeof window !== "undefined" ? window : this);
