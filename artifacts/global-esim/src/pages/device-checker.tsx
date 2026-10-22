import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleHelp,
  ExternalLink,
  LockKeyhole,
  Smartphone,
  ShieldCheck,
} from "lucide-react";

type DeviceBrand = "apple" | "google" | "samsung" | "other";
type PurchaseMarket = "AU" | "CN" | "HKMO" | "JP" | "TW" | "USCA" | "OTHER";
type CarrierLock = "unlocked" | "locked" | "unknown";
type ResultLevel = "likely" | "conditional" | "unsupported" | "verify";

type DeviceGuidance = {
  level: ResultLevel;
  title: string;
  summary: string;
  checks: string[];
};

const manufacturerSources = {
  apple: {
    label: "Apple: eSIM while travelling",
    url: "https://support.apple.com/en-us/118227",
  },
  google: {
    label: "Google Pixel: SIM and eSIM support",
    url: "https://support.google.com/pixelphone/answer/7086887?hl=en",
  },
  samsung: {
    label: "Samsung Australia: Galaxy eSIM compatibility",
    url: "https://www.samsung.com/au/support/mobile-devices/esim-compatibility",
  },
};

const installationSources = {
  apple: {
    label: "Apple iPhone setup guide",
    url: "https://support.apple.com/en-us/118669",
  },
  google: {
    label: "Google Pixel setup guide",
    url: "https://support.google.com/pixelphone/answer/14853135?hl=en",
  },
  samsung: {
    label: "Samsung Galaxy setup guide",
    url: "https://www.samsung.com/au/support/mobile-devices/how-to-install-nano-sim-card-and-esim-on-the-galaxy-s22-series/",
  },
};

function isSupportedIphoneModel(model: string) {
  return /^iphone\s*(?:xs(?:\s*max)?|xr|1[1-8](?:[a-z])?|air|duo|se\s*(?:\(?\s*(?:2nd|3rd|2|3|2020|2022)\s*(?:gen(?:eration)?)?\s*\)?))/i.test(
    model.trim(),
  );
}

function isMainlandChinaIphoneModel(model: string) {
  const normalized = model.trim().toLowerCase();
  return /^iphone\s+(?:18\s+pro(?:\s+max)?|duo|17e|air)(?:\b|\s)/i.test(
    normalized,
  );
}

function isListedSamsungModel(model: string) {
  const normalized = model.trim().toLowerCase();
  const patterns = [
    /^galaxy s(?:20|21|22)(?:\+|\s*ultra)?(?:\b|$)/,
    /^galaxy s(?:23|24|25|26)(?:\+|\s*(?:ultra|fe|edge))?(?:\b|$)/,
    /^galaxy z fold(?:\s*[2-8])?(?:\s*ultra)?\b/,
    /^galaxy z flip(?:\s*(?:[3-8](?:\s*fe)?|5g))?\b/,
    /^galaxy fold\b/,
    /^galaxy flip\b/,
    /^galaxy a(?:36|55|56)\s*5g\b/,
    /^galaxy xcover\s*7(?:\s*pro)?\b/,
    /^galaxy note\s*20(?:\s*ultra)?\b/,
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function getDeviceGuidance(
  brand: DeviceBrand,
  model: string,
  market: PurchaseMarket,
): DeviceGuidance {
  const normalized = model.trim().toLowerCase();
  if (brand === "apple") {
    if (!/^iphone\b/.test(normalized)) {
      return {
        level: "verify",
        title: "Check the exact iPhone model",
        summary:
          "Enter the full iPhone name from Settings or the box. eSIM support is model- and market-specific.",
        checks: [
          "iPhone XS, iPhone XS Max, iPhone XR, and later models are the general starting point in Apple’s travel guidance.",
        ],
      };
    }
    if (market === "CN") {
      if (isMainlandChinaIphoneModel(model)) {
        return {
          level: "likely",
          title: "This model is on Apple’s mainland China eSIM list",
          summary:
            "Apple’s linked guidance lists this iPhone family for eSIM in mainland China. Confirm the exact model number and supported carrier before purchase.",
          checks: [
            "Mainland China support differs from Apple’s general international eSIM guidance.",
            "A supported handset does not confirm that a particular plan or carrier will work.",
          ],
        };
      }
      return {
        level: "unsupported",
        title: "This model is not on Apple’s linked mainland China list",
        summary:
          "Apple’s linked guidance lists iPhone 18 Pro, iPhone 18 Pro Max, iPhone Duo, iPhone 17e, and iPhone Air for eSIM in mainland China.",
        checks: [
          "Check Apple’s current mainland China page for the exact model number before relying on eSIM support.",
        ],
      };
    }
    if (market === "HKMO") {
      return {
        level: "conditional",
        title: "Verify the exact regional model",
        summary:
          "Some iPhone models sold in Hong Kong and Macao use two physical SIMs instead of eSIM. The model name alone is not enough to confirm.",
        checks: [
          "Check the exact model number against Apple’s current regional guidance.",
          "Ask the eSIM provider to confirm compatibility with that model.",
        ],
      };
    }
    if (isSupportedIphoneModel(model)) {
      return {
        level: "likely",
        title: "This iPhone family is listed for eSIM",
        summary:
          "Apple’s general travel guidance starts with iPhone XS, iPhone XS Max, iPhone XR, and later. Regional variants and carrier restrictions can still change the result.",
        checks: [
          "Confirm the exact model and original sales region.",
          "Your selected provider must support eSIM for the destination and plan.",
        ],
      };
    }
    return {
      level: "unsupported",
      title: "This model is outside Apple’s general supported range",
      summary:
        "Apple’s general travel eSIM guidance starts with iPhone XS, iPhone XS Max, and iPhone XR. Confirm the exact model on Apple Support if the name is uncertain.",
      checks: [
        "The exact model number is more reliable than the product family name.",
      ],
    };
  }

  if (brand === "google") {
    const match = normalized.match(/\bpixel\s*(\d+)([a-z])?\b/i);
    if (!match) {
      return {
        level: "verify",
        title: "Check the Pixel model and original carrier",
        summary:
          "Google’s eSIM support depends on Pixel model, purchase market, and in some older models the original carrier.",
        checks: [
          "Find the full model in Settings, then compare it with Google’s linked support page.",
        ],
      };
    }
    const generation = Number(match[1]);
    const suffix = match[2] ?? "";
    if (generation <= 1 || /pixel\s*2016\b/i.test(normalized)) {
      return {
        level: "unsupported",
        title: "This Pixel generation is not listed for eSIM",
        summary:
          "Google’s linked guidance says the original Pixel (2016) does not support eSIM.",
        checks: [
          "Choose a device with eSIM support confirmed by Google and the intended provider.",
        ],
      };
    }
    if (generation === 2) {
      return {
        level: "conditional",
        title: "Pixel 2 support is limited",
        summary:
          "Google says only Pixel 2 phones bought with Google Fi service work with eSIM.",
        checks: [
          "Confirm the phone was originally purchased with Google Fi service.",
          "Check carrier lock and plan support before buying.",
        ],
      };
    }
    if (generation === 3 && !suffix) {
      if (market === "AU" || market === "JP" || market === "TW") {
        return {
          level: "unsupported",
          title: "Google lists this Pixel 3 market variant as unsupported",
          summary:
            "Google says Pixel 3 phones bought in Australia, Taiwan, and Japan do not work with eSIM.",
          checks: [
            "Confirm with Google or the original carrier if the phone’s purchase market is different.",
          ],
        };
      }
      return {
        level: "conditional",
        title: "Pixel 3 support depends on its original carrier",
        summary:
          "Google says US and Canadian Pixel 3 models need to have been bought with Sprint or Google Fi service. Other carrier variants may not support eSIM.",
        checks: [
          "Confirm the original carrier and purchase market.",
          "Check the exact model with the intended provider.",
        ],
      };
    }
    if (generation === 3 && suffix === "a") {
      if (market === "JP") {
        return {
          level: "unsupported",
          title: "Google lists Japan Pixel 3a models as unsupported",
          summary:
            "Google says Pixel 3a phones bought in Japan do not work with eSIM.",
          checks: ["Confirm the model against Google’s linked support page."],
        };
      }
      return {
        level: "conditional",
        title: "Verify this Pixel 3a variant",
        summary:
          "Google says Pixel 3a phones bought with Verizon service or in Japan do not work with eSIM. Other variants still need carrier confirmation.",
        checks: [
          "If bought in the US, confirm it was not a Verizon version.",
          "Ask the intended provider to confirm the exact model.",
        ],
      };
    }
    if (generation >= 4) {
      return {
        level: "likely",
        title: "This Pixel generation is listed for eSIM",
        summary:
          "Google says Pixel 4 and later phones work with eSIM. The mobile carrier must also support eSIM for your plan.",
        checks: [
          "Confirm carrier unlock status.",
          "Check that the plan supports the destination and device.",
        ],
      };
    }
    return {
      level: "verify",
      title: "Confirm this Pixel variant",
      summary:
        "Google’s published guidance has specific model and market exceptions. Use the exact model and original carrier to verify.",
      checks: [
        "Check Google’s linked support page and contact the original carrier.",
      ],
    };
  }

  if (brand === "samsung") {
    const listed = isListedSamsungModel(model);
    if (!listed) {
      return {
        level: "verify",
        title: "Check Samsung’s specifications for this exact model",
        summary:
          "Galaxy eSIM support changes by model and country of sale. This checker only recognises models on Samsung Australia’s published list.",
        checks: [
          "On Samsung Support, find your exact model and look for Embedded-SIM under Network/Bearer.",
          "Menu names and support can vary by market and carrier.",
        ],
      };
    }
    if (market !== "AU") {
      return {
        level: "conditional",
        title: "This model appears on Samsung Australia’s list",
        summary:
          "Samsung’s list is for Australian variants. A similarly named phone bought elsewhere may have different eSIM support.",
        checks: [
          "Verify the exact model number in your country’s Samsung specifications.",
          "Confirm the intended provider supports the device.",
        ],
      };
    }
    return {
      level: "likely",
      title: "This Galaxy family is listed by Samsung Australia",
      summary:
        "Samsung lists this model family for Australian variants. Check the exact model number and carrier before relying on eSIM support.",
      checks: [
        "Samsung notes that support can vary by country of origin and carrier.",
        "Confirm the intended provider supports the model and destination.",
      ],
    };
  }

  return {
    level: "verify",
    title: "Check the manufacturer’s exact model list",
    summary:
      "This checker does not have a verified compatibility list for this manufacturer. Search the maker’s specifications for Embedded SIM or eSIM.",
    checks: [
      "Ask the intended eSIM provider to confirm the exact model number.",
      "Check whether the device is carrier-unlocked.",
    ],
  };
}

function getInstallSteps(brand: DeviceBrand) {
  if (brand === "apple")
    return [
      "Connect to Wi-Fi or a hotspot.",
      "Open Settings → Cellular (or Mobile Data) → Add eSIM.",
      "Use the QR code or activation details supplied by your eSIM provider, then follow the on-screen steps.",
    ];
  if (brand === "google")
    return [
      "Connect to Wi-Fi.",
      "Open Settings → Network & internet → SIMs → Add SIM → Set up an eSIM.",
      "Follow Google’s prompts and the activation steps supplied by your eSIM provider.",
    ];
  if (brand === "samsung")
    return [
      "Connect to Wi-Fi.",
      "Open Settings → Connections → SIM manager → Add eSIM.",
      "Follow Samsung’s prompts and the activation steps supplied by your eSIM provider.",
    ];
  return [
    "Connect to Wi-Fi.",
    "Open the manufacturer’s support guide for your exact device and find its eSIM setup steps.",
    "Use only the activation details supplied by your chosen eSIM provider.",
  ];
}

function levelLabel(level: ResultLevel) {
  if (level === "likely") return "LIKELY DEVICE SUPPORT";
  if (level === "conditional") return "CHECK THE VARIANT";
  if (level === "unsupported") return "NOT LISTED AS SUPPORTED";
  return "MANUAL VERIFICATION NEEDED";
}

export default function DeviceCheckerPage() {
  const [brand, setBrand] = useState<DeviceBrand>("apple");
  const [model, setModel] = useState("");
  const [market, setMarket] = useState<PurchaseMarket>("OTHER");
  const [carrierLock, setCarrierLock] = useState<CarrierLock>("unknown");
  const [checked, setChecked] = useState(false);
  const guidance = useMemo(
    () => getDeviceGuidance(brand, model, market),
    [brand, model, market],
  );
  const installSteps = useMemo(() => getInstallSteps(brand), [brand]);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
  };
  const icon =
    guidance.level === "likely" ? (
      <Check size={20} />
    ) : guidance.level === "unsupported" ? (
      <AlertTriangle size={20} />
    ) : (
      <CircleHelp size={20} />
    );

  return (
    <section className="page-shell device-checker-page">
      <div className="device-intro">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> DEVICE COMPATIBILITY
          </div>
          <h1>Will your phone work with an eSIM?</h1>
          <p>
            Check the handset first, then confirm the exact model with the
            carrier or eSIM provider you plan to use.
          </p>
        </div>
        <span className="device-sandbox-tag">
          <ShieldCheck size={15} /> Manufacturer guidance, not a live network
          check
        </span>
      </div>

      <div className="device-check-grid">
        <form className="device-card device-check-form" onSubmit={handleSubmit}>
          <div className="device-card-heading">
            <span className="device-icon">
              <Smartphone size={19} />
            </span>
            <div>
              <div className="eyebrow">START WITH YOUR PHONE</div>
              <h2>Check your model</h2>
            </div>
          </div>
          <label className="device-field-label" htmlFor="device-brand">
            Manufacturer
          </label>
          <select
            id="device-brand"
            className="device-control"
            value={brand}
            onChange={(event) => setBrand(event.target.value as DeviceBrand)}
          >
            <option value="apple">Apple iPhone</option>
            <option value="google">Google Pixel</option>
            <option value="samsung">Samsung Galaxy</option>
            <option value="other">Another brand</option>
          </select>
          <label className="device-field-label" htmlFor="device-model">
            Exact model name
          </label>
          <input
            id="device-model"
            className="device-control"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder={
              brand === "apple"
                ? "e.g. iPhone 15 Pro"
                : brand === "google"
                  ? "e.g. Pixel 8"
                  : brand === "samsung"
                    ? "e.g. Galaxy S24"
                    : "Enter the model name"
            }
            required
          />
          <p className="device-input-help">
            Use the model name shown in your device settings or on its original
            packaging.
          </p>
          <label className="device-field-label" htmlFor="device-market">
            Where was the phone bought?
          </label>
          <select
            id="device-market"
            className="device-control"
            value={market}
            onChange={(event) =>
              setMarket(event.target.value as PurchaseMarket)
            }
          >
            <option value="OTHER">Other / not sure</option>
            <option value="AU">Australia</option>
            <option value="CN">Mainland China</option>
            <option value="HKMO">Hong Kong or Macao</option>
            <option value="JP">Japan</option>
            <option value="TW">Taiwan</option>
            <option value="USCA">United States or Canada</option>
          </select>
          <label className="device-field-label" htmlFor="device-lock">
            Is it unlocked from its original carrier?
          </label>
          <select
            id="device-lock"
            className="device-control"
            value={carrierLock}
            onChange={(event) =>
              setCarrierLock(event.target.value as CarrierLock)
            }
          >
            <option value="unknown">Not sure</option>
            <option value="unlocked">Yes, unlocked</option>
            <option value="locked">No, carrier-locked</option>
          </select>
          <button className="button button-primary device-submit" type="submit">
            Check compatibility <ArrowRight size={16} />
          </button>
        </form>

        <section
          className="device-card device-check-result"
          aria-label="Compatibility result"
        >
          {checked ? (
            <div className="device-result" aria-live="polite">
              <div
                className={
                  "device-result-status device-status-" + guidance.level
                }
              >
                <span>{icon}</span>
                <div>
                  <div className="eyebrow">{levelLabel(guidance.level)}</div>
                  <h2>{guidance.title}</h2>
                  <p>{guidance.summary}</p>
                </div>
              </div>
              <ul className="device-result-list">
                {guidance.checks.map((item) => (
                  <li key={item}>
                    <Check size={15} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {carrierLock === "locked" ? (
                <div className="device-lock-callout">
                  <LockKeyhole size={17} />
                  <p>
                    <strong>Carrier lock may block another eSIM.</strong> Ask
                    the original carrier about unlocking before buying a plan.
                  </p>
                </div>
              ) : carrierLock === "unknown" ? (
                <div className="device-lock-callout">
                  <LockKeyhole size={17} />
                  <p>
                    <strong>Check the unlock status.</strong> A device locked to
                    another carrier may not accept a travel eSIM.
                  </p>
                </div>
              ) : (
                <div className="device-unlocked-note">
                  <Check size={16} /> You marked this device as unlocked.
                </div>
              )}
              <div className="device-caveat">
                <CircleHelp size={16} />
                <p>
                  This checks device eSIM capability only. It cannot confirm
                  live plan availability, destination coverage, network bands,
                  or activation by a supplier.
                </p>
              </div>
            </div>
          ) : (
            <div className="device-result-empty">
              <span className="device-icon">
                <Smartphone size={19} />
              </span>
              <div className="eyebrow">YOUR RESULT WILL APPEAR HERE</div>
              <h2>Start with the exact model</h2>
              <p>
                Model and original sales market matter. The result will point
                out any manufacturer-specific exceptions.
              </p>
            </div>
          )}
        </section>
      </div>

      <div className="device-guide-grid">
        <article className="device-card device-guide-card">
          <div className="eyebrow">WHEN YOU RECEIVE YOUR PROFILE</div>
          <h2>Install with the provider’s instructions</h2>
          <p>
            Do not try to install an eSIM until a legitimate provider has issued
            an activation profile for your order.
          </p>
          <ol>
            {installSteps.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          {brand !== "other" && (
            <a
              className="device-install-link"
              href={installationSources[brand].url}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open {installationSources[brand].label}
              <ExternalLink size={14} />
            </a>
          )}
          <p className="device-guide-note">
            <LockKeyhole size={15} /> Keep QR codes and activation details
            private. This sandbox does not generate or activate eSIM profiles.
          </p>
        </article>
        <article className="device-card device-checklist-card">
          <div className="eyebrow">BEFORE YOU BUY</div>
          <h2>Three things to confirm</h2>
          <ul className="device-checklist">
            <li>
              <Check size={16} />
              <span>
                <strong>Exact model and region</strong> — the same phone family
                can have different hardware by country.
              </span>
            </li>
            <li>
              <Check size={16} />
              <span>
                <strong>Carrier lock</strong> — ask the original carrier to
                unlock it if needed.
              </span>
            </li>
            <li>
              <Check size={16} />
              <span>
                <strong>Plan support</strong> — confirm the provider covers your
                destination and device.
              </span>
            </li>
          </ul>
          <p className="device-guide-note">
            <ShieldCheck size={15} /> A compatible handset is not a guarantee of
            service or anonymity.
          </p>
        </article>
      </div>

      <section className="device-sources">
        <div>
          <div className="eyebrow">CHECK THE SOURCE</div>
          <h2>Manufacturer guidance</h2>
          <p>
            Model lists and setup steps can change. Verify the exact device
            before purchase.
          </p>
        </div>
        <div className="device-source-links">
          <a
            href={manufacturerSources.apple.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {manufacturerSources.apple.label}
            <ExternalLink size={14} />
          </a>
          <a
            href={manufacturerSources.google.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {manufacturerSources.google.label}
            <ExternalLink size={14} />
          </a>
          <a
            href={manufacturerSources.samsung.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {manufacturerSources.samsung.label}
            <ExternalLink size={14} />
          </a>
        </div>
      </section>
    </section>
  );
}
