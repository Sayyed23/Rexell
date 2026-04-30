# Chapter 7. Project Schedule

**Project:** Event Ticket Scalping Prevention Using Blockchain and AI

---

## 7.2 Task Network

The task network defines the dependency chain among major activities. By establishing a clear flow from analysis to deployment, the team can ensure modules are integrated in the correct sequence.

```mermaid
flowchart LR
    %% Clean, modern styling
    classDef plan fill:#E3F2FD,stroke:#1E88E5,stroke-width:2px,color:#0D47A1,rx:5px,ry:5px
    classDef dev fill:#FFF3E0,stroke:#FB8C00,stroke-width:2px,color:#E65100,rx:5px,ry:5px
    classDef ai fill:#F3E5F5,stroke:#8E24AA,stroke-width:2px,color:#4A148C,rx:5px,ry:5px
    classDef finish fill:#E8F5E9,stroke:#43A047,stroke-width:2px,color:#1B5E20,rx:5px,ry:5px

    %% Nodes
    A([Requirement Analysis]):::plan --> B([System Design & Architecture]):::plan
    
    %% Parallel Dev
    B --> C([Smart Contracts]):::dev
    B --> D([Frontend UI]):::dev
    
    C --> E([Transaction Pipelines]):::dev
    D --> E
    
    %% AI Integration
    F([AI Model Training]):::ai --> G([AI Fraud Detection Integration]):::ai
    E --> G
    
    %% Testing & Deploy
    C --> H([Final Testing]):::finish
    D --> H
    G --> H
    
    H --> I([Deployment]):::finish
```

### Dependency Rules:
1. **Analysis First:** Requirement analysis precedes system design.
2. **Parallel Development:** Smart contracts and UI develop simultaneously after architecture is finalized.
3. **Data Dependency:** AI fraud detection is only integrated *after* transaction data pipelines are ready.
4. **All Systems Go:** Final testing begins only when all modules (Contracts, UI, AI) are connected.

---

## 7.3 Timeline Charts

The execution schedule helps the team track milestones and ensure timely completion across the semester. 

```mermaid
gantt
    title Semester Execution Timeline
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d
    
    section 1. Planning
    Requirement Analysis       :crit, a1, 2026-05-01, 14d
    System Design              :a2, after a1, 14d

    section 2. Development
    Smart Contracts            :a3, after a2, 28d
    Frontend UI                :a4, after a2, 28d
    Data Pipelines             :a5, after a3, 14d

    section 3. AI & ML
    AI Model Training          :a6, 2026-05-15, 42d
    Fraud Detection Integration:a7, after a5, 14d

    section 4. Delivery
    Final Testing              :crit, a8, after a7, 14d
    Deployment                 :crit, a9, after a8, 7d

    section Ongoing
    Documentation              :a10, 2026-05-01, 120d
    Presentations              :a11, after a8, 21d
```
