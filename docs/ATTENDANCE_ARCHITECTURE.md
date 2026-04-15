# Attendance — system design (flowcharts)

How **Mark attendance** works: the system checks **where** you are and **who** you are before recording your day.

---

## Big picture

```mermaid
flowchart LR
  A[Employee opens\nMark attendance] --> B[Step 1:\nWhere are you?]
  B --> C[Step 2:\nWho are you?\nFace check]
  C --> D[Save:\nChecked in or out]
  D --> E[Manager can see\nin team reports]
```

---

## Step 1 — Location (are you at the office?)

```mermaid
flowchart TD
  Start([Employee taps\nMark attendance]) --> Phone[Phone asks:\nMay we use your location?]
  Phone -->|No| Stop1([Cannot continue\nwithout location])
  Phone -->|Yes| GPS[Phone finds GPS position]
  GPS --> Send[System compares position\nto office address on map]
  Send --> Near{Inside allowed\nradius?}
  Near -->|No| Msg1[Show: you are too far\nfrom office]
  Near -->|Yes| OK[Location step passed\nshort-lived pass issued]
  OK --> FaceGo([Continue to face step])
  Msg1 --> Retry([Employee can retry])
```

**In plain words:** The office location and “how close is close enough” are set once by an admin. The phone must be allowed to use GPS, and the employee must be within that distance.

---

## Step 2 — Face (is it really you?)

```mermaid
flowchart TD
  Start([Location already OK]) --> Setup{Has employee ever\nregistered their face?}
  Setup -->|No| Enroll[Employee adds a face profile\nfrom Profile first]
  Setup -->|Yes| Cam[Phone turns on camera]
  Enroll --> Cam
  Cam --> Snap[System compares live face\nto saved face profile]
  Snap --> Match{Similar enough?}
  Match -->|No| Try[Show try again\nlimited attempts]
  Try --> Fail{Too many fails?}
  Fail -->|Yes| MarkFail[Day may be marked\nas face check failed]
  Fail -->|No| Cam
  Match -->|Yes| Done([Face step passed])
```

**In plain words:** Earlier, the employee saves a “face profile” from a photo or camera. At check-in, the live camera must match that profile within a tolerance set by the company.

---

## Check-in vs check-out

```mermaid
flowchart TD
  Today{Already checked in\ntoday?}
  Today -->|No| In[Flow = Check in\nrecord arrival time]
  Today -->|Yes, not out yet| Out[Flow = Check out\nrecord leave time]
  Today -->|Already out| Done([Nothing else\nto do today])
  In --> Both[Both steps use:\nlocation + face]
  Out --> Both
```

---

## What gets saved (conceptual)

```mermaid
flowchart LR
  subgraph record["One row per person per day"]
    D[Date]
    T1[Arrival time]
    T2[Leave time]
    S[Status:\nPresent / Failed / Manual / …]
  end
  Employee --> record
  Manager --> View[Team view & exports]
  record --> View
```

---

## When things go wrong

```mermaid
flowchart TD
  P[Problem] --> Q1{Location issue?}
  Q1 -->|Yes| A1[HTTPS required on phone;\nallow location;\nsame Wi‑Fi or correct app URL]
  Q1 -->|No| Q2{Face issue?}
  Q2 -->|Yes| A2[Lighting / camera permission;\ncomplete face profile in Profile]
  Q2 -->|No| Q3{Account issue?}
  Q3 -->|Yes| A3[User must belong to a company\norganization in the system]
```

---

## Admin side (setup)

```mermaid
flowchart TD
  Admin([Admin]) --> Set[Set office on map\n+ allowed distance]
  Set --> Thr[Set how strict\nface matching is]
  Thr --> Live[Employees can now\nuse Mark attendance]
  Admin --> Report[View team attendance,\nheatmap, export]
  Admin --> Override[Manually set\npresent / absent if needed]
```

---

*This describes behavior, not code. For implementation detail, see the codebase.*
