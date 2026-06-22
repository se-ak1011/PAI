# PAI — Polish List ("nice → premium")

The goal: make people go **"Ooo…"**. Small, high-leverage touches that signal
craft. None of these are features — they're the *feel*.

> Already installed (so most of this is low-friction): `expo-haptics`,
> `react-native-reanimated` 4 + `react-native-worklets`, `@gorhom/bottom-sheet`,
> `expo-image`, `react-native-gesture-handler`.
> Would need adding: `lottie-react-native` (illustrations/animated states),
> a confetti lib (or build with Reanimated).

## Effort legend
- 🟢 quick (≤30 min) · 🟡 medium · 🔴 bigger · 🆕 needs a new dependency

---

## 1. Haptic feedback (`expo-haptics` — already in) 🟢
The single highest "feels premium per minute of work" item.
- Light impact on major button presses (Save Job, Start Trial, Send Invoice, role switch).
- Success notification haptic on: job saved, invoice marked paid, quote generated.
- Warning/error haptic on failed actions (AI error, validation).
- Selection haptic on toggles, trade-chip selection, tab changes.
- **Do it once well:** wrap in a tiny `haptics.ts` helper (`tap()`, `success()`,
  `warn()`, `select()`) and sprinkle — consistent, not random.

## 2. Motion & transitions (Reanimated 4 — already in) 🟡
- Button press **scale** (0.97) + spring back on all primary buttons.
- **Spring** on role switcher pill (the active pill slides/scales between options).
- Card **entrance** stagger (fade + 8px rise) when lists load.
- Smooth screen/card transitions (shared-element feel on job → job-detail).
- Number **count-up** on the earnings figure + Tax Pot totals (animate to value).
- Animated progress bar fill on "Get set up" (currently static width).

## 3. Loading & empty states 🟡 (🆕 for illustrations)
- **Skeleton loaders** (shimmer) instead of blank screens / spinners — jobs list,
  marketplace, profile, Tax Pot. Build one reusable `<Skeleton>` shimmer (Reanimated).
- Replace bare `ActivityIndicator` moments with skeletons or branded loaders.
- **Empty states with illustration + microcopy** (jobs, marketplace, Tax Pot,
  portfolio, notifications). 🆕 Lottie or simple branded SVGs.
- Pull-to-refresh with a branded refresh control.

## 4. Delight moments 🟡 🆕
- **Confetti** after posting first job / generating first quote / first paid invoice.
- Subtle success checkmark animation (draw-on) on completed actions.
- "Milestone" toasts ("🎉 First £1,000 set aside!").
- First-run subtle coach marks on the dashboard (once).

## 5. Visual & icons 🟡
- Audit icon consistency (all MaterialIcons now — consider a more distinctive set
  for hero actions, or custom brass-accented icons to match the logo).
- Consistent corner radii, shadows/elevation on cards (depth = premium).
- Gradient or subtle texture on the earnings/hero cards.
- App-wide consistent spacing rhythm pass.

## 6. Microcopy ("human, not robotic") 🟢
- Empty states: "No jobs yet — let's change that." / "Your Tax Pot is empty.
  Log a job and watch it grow."
- Buttons with intent: "Generate AI Quote" → keep; "Save Job" → "Save & continue".
- Friendly errors: replace generic alerts with specific, kind copy.
- Loading copy that has personality ("Crunching the numbers…", "Reading your receipt…").
- Trial nudges that don't feel salesy.

## 7. Small correctness/feel details 🟢
- Keyboard handling: `KeyboardAvoidingView` / `keyboard-controller` on all forms.
- Input focus states (border glow on focus).
- Disabled-button states that look intentional (not just dimmed).
- Tab bar active indicator animation.
- Respect reduced-motion accessibility setting for all the above.

---

### Suggested order (compounding "Ooo")
1. **Haptics helper + sprinkle** (🟢, huge perceived-quality jump).
2. **Button press-scale + role-switcher spring** (🟡).
3. **Skeleton loaders** (🟡, kills the "blank screen" cheap feeling).
4. **Microcopy + empty states pass** (🟢).
5. **Count-up numbers + confetti milestones** (🟡🆕, the screenshot moments).
