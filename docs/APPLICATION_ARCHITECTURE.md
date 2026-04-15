# ConnectPlus — system design (flowcharts)

What the product is, who uses what, and how information moves—without engineering detail.

---

## What ConnectPlus is

```mermaid
flowchart TB
  subgraph product["ConnectPlus"]
    CRM[Customer & sales work\nleads, deals, delivery teams]
    People[People & workplace\ntasks, time, leave, HR views]
  end
  Staff[Company staff] --> product
  Leaders[Managers & admins] --> product
```

One company account holds **organizations**, **users**, and **roles** (who can see or change what).

---

## Main pieces of the system

```mermaid
flowchart LR
  subgraph users["People"]
    Browser[Web browser\non computer]
    Phone[Web browser\non phone]
  end

  subgraph apps["ConnectPlus apps"]
    WebApp[Full workplace & CRM\nweb application]
    MobileWeb[Mobile-friendly app\nsame login, simpler screens]
  end

  subgraph center["Company server"]
    Brain[Central service\nrules, security, data]
    Vault[(Secure database)]
    Files[(File storage\nphotos, attachments)]
  end

  Browser --> WebApp
  Phone --> MobileWeb
  WebApp --> Brain
  MobileWeb --> Brain
  Brain --> Vault
  Brain --> Files
```

**Plain words:** Staff use either the **full web app** or the **mobile web app**. Both talk to the same **central service** that stores data in a **database** and **files** where needed.

---

## Signing in

```mermaid
flowchart TD
  Open([User opens app]) --> How{How to sign in?}
  How -->|Company email & password| PW[Enter credentials]
  How -->|Microsoft / Office 365| MS[Sign in with Microsoft]
  PW --> Check[System checks account]
  MS --> Check
  Check --> OK{Valid?}
  OK -->|No| Deny[Show error]
  OK -->|Yes| Session[User is signed in\nsees allowed menus]
```

New employees from the company domain can often be **created automatically** the first time they sign in with Microsoft, and placed in the right **organization**.

---

## Who sees what (idea)

```mermaid
flowchart TD
  Role{Role}
  Role -->|Everyday user| U[Own tasks, attendance,\nleave, profile]
  Role -->|Manager types| M[Team views,\nattendance reports, …]
  Role -->|Admin| A[Settings, users,\nattendance setup, overrides]
  Role -->|Super admin| S[Multiple organizations,\nplatform-level setup]
```

Exact menus depend on how your company configured **roles** and **modules**.

---

## Typical day for an employee (mobile)

```mermaid
flowchart LR
  L[Login] --> T[See my tasks]
  T --> A[Mark attendance\nwhen at office]
  A --> V[View leave balance\nor request time off]
  V --> P[Update profile / photo]
```

---

## Typical day for a manager

```mermaid
flowchart LR
  L[Login] --> R[Review team attendance\nor task progress]
  R --> E[Export or print reports\nif available]
  E --> O[Override attendance\nwhen something was wrong]
```

---

## Data stays with the company

```mermaid
flowchart TD
  subgraph company["Your company"]
    App[ConnectPlus]
    DB[(Your data)]
  end
  subgraph optional["Optional cloud services"]
    MS[Microsoft login & email\nif you enabled them]
  end
  App --> DB
  App -.->|only if configured| MS
```

Customer and HR data live in **your** database; Microsoft is used only for **sign-in** (and optional mail features) if you turned that on.

---

## How the two apps relate

```mermaid
flowchart TB
  Same[Same accounts\nsame permissions\nsame data]
  Web[Full web app\nmore screens & CRM depth]
  Mob[Mobile web app\nfocused on tasks & daily HR]
  Same --> Web
  Same --> Mob
```

---

## Related document

- **[Attendance — system design](./ATTENDANCE_ARCHITECTURE.md)** — flowcharts only for check-in (location + face).

---

*For technical implementation (APIs, databases, file paths), refer to the source code and developer docs.*
