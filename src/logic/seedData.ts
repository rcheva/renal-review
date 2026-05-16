import { db } from "./db";
import { newDeck } from "./deck/newDeck";
import { BasicNoteTypeAdapter } from "./type-implementations/normal/BasicNote";
import { ckdAudioOverviewUrl, ckdBriefingDocUrl, ckdSlideDeckUrl, ckdStudyGuideUrl, akiAudioOverviewUrl, akiBriefingDocUrl, akiSlideDeckUrl, akiStudyGuideUrl } from "./notebookLMData";
import { v4 as uuidv4 } from "uuid";

const topics = [
  "CKD",
  "AKI",
  "GMN",
  "Dialysis",
  "Transplant",
  "Electrolytes",
  "Hypertension",
  "Genetics / Rare",
  "Guidelines",
  "RCT",
];

const ckdQuestions = [
  { front: "What is the most common cause of CKD worldwide?", back: "Diabetes mellitus." },
  { front: "What GFR defines Stage 3a CKD?", back: "45-59 mL/min/1.73 m²." },
  { front: "What GFR defines Stage 4 CKD?", back: "15-29 mL/min/1.73 m²." },
  { front: "What is the primary medication class used to slow progression of proteinuric CKD?", back: "ACE inhibitors or ARBs." },
  { front: "Which oral antidiabetic drug is contraindicated in severe CKD (eGFR < 30)?", back: "Metformin." },
  { front: "What is a common complication of CKD relating to bone health?", back: "Secondary hyperparathyroidism (CKD-MBD)." },
  { front: "What type of anemia is typically seen in CKD?", back: "Normochromic, normocytic anemia (due to decreased EPO production)." },
  { front: "What is the target blood pressure for most patients with CKD?", back: "< 130/80 mmHg." },
  { front: "Which new class of diabetes medication has shown significant renoprotective effects?", back: "SGLT2 inhibitors." },
  { front: "At what GFR is a patient typically considered for preemptive kidney transplant evaluation?", back: "< 20 mL/min/1.73 m²." },
];

const akiQuestions = [
  { front: "What are the three main categories of AKI?", back: "Prerenal, Intrinsic, and Postrenal." },
  { front: "What is the most common cause of intrinsic AKI in hospitalized patients?", back: "Acute Tubular Necrosis (ATN)." },
  { front: "What BUN/Creatinine ratio suggests a prerenal cause of AKI?", back: "> 20:1." },
  { front: "What finding on urinalysis is classic for Acute Tubular Necrosis?", back: "Muddy brown granular casts." },
  { front: "What is the fractional excretion of sodium (FENa) typically seen in prerenal AKI?", back: "< 1%." },
  { front: "Name three medications known to cause Acute Interstitial Nephritis (AIN).", back: "NSAIDs, Penicillins, PPIs." },
  { front: "What is a classic systemic sign of Acute Interstitial Nephritis?", back: "Rash, fever, and eosinophilia (though full triad is rare)." },
  { front: "What ultrasound finding suggests postrenal AKI?", back: "Hydronephrosis." },
  { front: "What is the KDIGO criteria for diagnosing AKI based on serum creatinine?", back: "Increase by ≥ 0.3 mg/dL within 48 hrs OR increase to ≥ 1.5 times baseline within 7 days." },
  { front: "When is urgent dialysis indicated in AKI? (Hint: AEIOU)", back: "Acidosis, Electrolytes (severe hyperkalemia), Intoxication, Overload (fluid), Uremia." },
];

const electrolytesQuestions = [
  { front: "What is the initial treatment for severe hyperkalemia with EKG changes?", back: "IV Calcium Gluconate (to stabilize the myocardium)." },
  { front: "How does insulin lower serum potassium?", back: "Drives potassium into cells via the Na+/K+ ATPase pump." },
  { front: "What is the formula for calculating plasma osmolality?", back: "2*Na + (BUN/2.8) + (Glucose/18)." },
  { front: "What is the most dangerous complication of correcting hyponatremia too quickly?", back: "Osmotic Demyelination Syndrome (Central Pontine Myelinolysis)." },
  { front: "What is the standard maximum rate of sodium correction in chronic hyponatremia?", back: "8 mEq/L per 24 hours." },
  { front: "What condition is characterized by hypernatremia with dilute urine?", back: "Diabetes Insipidus." },
  { front: "What is the typical EKG finding in severe hypokalemia?", back: "U waves and flattened T waves." },
  { front: "What electrolyte abnormality makes hypokalemia difficult to correct?", back: "Hypomagnesemia." },
  { front: "What is Chvostek sign and what does it indicate?", back: "Facial muscle twitching upon tapping the facial nerve; indicates hypocalcemia." },
  { front: "What medication is commonly used to treat SIADH if fluid restriction fails?", back: "Tolvaptan (or other vaptans) or Demeclocycline." },
];

export async function seedAllContent() {
  const existingDecks = await db.decks.toArray();
  
  // Create Main Topics
  for (const topic of topics) {
    if (!existingDecks.some((d) => d.name === topic && (!d.superDecks || d.superDecks.length === 0))) {
      await newDeck(topic);
    }
  }

  // Reload to get fresh IDs
  const allDecks = await db.decks.toArray();

  const getTopicDeck = (name: string) => allDecks.find((d) => d.name === name && (!d.superDecks || d.superDecks.length === 0));

  const ckdDeck = getTopicDeck("CKD");

  // Inject NotebookLM Study Materials into CKD Deck
  if (ckdDeck) {
    const existingMaterials = ckdDeck.studyMaterials || [];
    const materialsToInject = [
      {
        id: uuidv4(),
        type: "audio" as const,
        title: "2024 KDIGO Guidelines Audio Overview",
        url: ckdAudioOverviewUrl,
        createdAt: new Date(),
      },
      {
        id: uuidv4(),
        type: "ppt" as const,
        title: "KDIGO 2024 CKD Playbook",
        url: ckdSlideDeckUrl,
        createdAt: new Date(),
      },
      {
        id: uuidv4(),
        type: "doc" as const,
        title: "KDIGO 2024 Briefing Document",
        url: ckdBriefingDocUrl,
        createdAt: new Date(),
      },
      {
        id: uuidv4(),
        type: "doc" as const,
        title: "Comprehensive CKD Study Guide",
        url: ckdStudyGuideUrl,
        createdAt: new Date(),
      }
    ];

    const newMaterials = materialsToInject.filter(
      (mat) => !existingMaterials.some((ex) => ex.title === mat.title)
    );

    if (newMaterials.length > 0) {
      await db.decks.update(ckdDeck.id, { 
        studyMaterials: [...existingMaterials, ...newMaterials] 
      });
    }
  }
  const akiDeck = getTopicDeck("AKI");

  if (akiDeck) {
    const existingMaterials = akiDeck.studyMaterials || [];
    const materialsToInject = [
      {
        id: uuidv4(),
        type: "audio" as const,
        title: "AKI and Critical Care Nephrology Audio Overview",
        url: akiAudioOverviewUrl,
        createdAt: new Date(),
      },
      {
        id: uuidv4(),
        type: "ppt" as const,
        title: "AKI 2024 Playbook",
        url: akiSlideDeckUrl,
        createdAt: new Date(),
      },
      {
        id: uuidv4(),
        type: "doc" as const,
        title: "AKI 2024 Briefing Document",
        url: akiBriefingDocUrl,
        createdAt: new Date(),
      },
      {
        id: uuidv4(),
        type: "doc" as const,
        title: "Comprehensive AKI Study Guide",
        url: akiStudyGuideUrl,
        createdAt: new Date(),
      }
    ];

    const validMaterials = materialsToInject.filter(m => {
      if ((m.type === 'audio' || m.type === 'ppt') && !m.url) return false;
      return true;
    });

    const newMaterials = validMaterials.filter(
      (mat) => !existingMaterials.some((ex) => ex.title === mat.title)
    );

    if (newMaterials.length > 0) {
      await db.decks.update(akiDeck.id, { 
        studyMaterials: [...existingMaterials, ...newMaterials] 
      });
    }
  }

  const electroDeck = getTopicDeck("Electrolytes");

  // Create Subdecks and seed questions
  if (ckdDeck && !allDecks.some((d) => d.name === "CKD Basics")) {
    const subDeckId = await newDeck("CKD Basics", ckdDeck);
    const subDeck = await db.decks.get(subDeckId);
    if (subDeck) {
      for (const q of ckdQuestions) {
        await BasicNoteTypeAdapter.createNote({ front: q.front, back: q.back }, subDeck);
      }
    }
  }

  if (akiDeck && !allDecks.some((d) => d.name === "AKI Fundamentals")) {
    const subDeckId = await newDeck("AKI Fundamentals", akiDeck);
    const subDeck = await db.decks.get(subDeckId);
    if (subDeck) {
      for (const q of akiQuestions) {
        await BasicNoteTypeAdapter.createNote({ front: q.front, back: q.back }, subDeck);
      }
    }
  }

  if (electroDeck && !allDecks.some((d) => d.name === "Electrolyte Imbalances")) {
    const subDeckId = await newDeck("Electrolyte Imbalances", electroDeck);
    const subDeck = await db.decks.get(subDeckId);
    if (subDeck) {
      for (const q of electrolytesQuestions) {
        await BasicNoteTypeAdapter.createNote({ front: q.front, back: q.back }, subDeck);
      }
    }
  }
}
