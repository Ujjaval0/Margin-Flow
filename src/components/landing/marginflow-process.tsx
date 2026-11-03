import { Fragment } from "react";
import styles from "./marginflow-process.module.css";

const steps = [
  {
    title: "Bring your data together",
    description: "Connect your store or upload orders. Add the cost of each product.",
    example: "Orders + costs",
    owner: "You",
    icon: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  },
  {
    title: "Understand your profit",
    description: "We match every order to its cost and work out what you keep.",
    example: "Sale ₹1,000 → ₹350",
    owner: "Automatic",
    icon: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  },
  {
    title: "Check payouts and returns",
    description: "We compare what you should get with what arrived, and flag the gap.",
    example: "₹850 vs ₹790 · −₹60",
    owner: "Automatic",
    icon: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
  },
  {
    title: "Claim and track recovery",
    description: "We prepare the claim. You review and submit it. We log what comes back.",
    example: "Recovered ₹60",
    owner: "You",
    icon: <path d="M5 12l5 5 9-10" />,
  },
];

export function MarginFlowProcess() {
  return (
    <ol className={styles.process} aria-label="How MarginFlow works">
      {steps.map((step, index) => (
        <Fragment key={step.title}>
          <li className={`${styles.card} ${index % 2 ? styles.right : ""} ${step.owner === "You" ? styles.manual : ""}`}>
            <div className={styles.owner}><span>{step.owner}</span></div>
            <div className={styles.content}>
              <div className={styles.heading}>
                <span className={styles.icon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {step.icon}
                  </svg>
                </span>
                <h3>{index + 1} {step.title}</h3>
              </div>
              <p>{step.description}</p>
              <span className={styles.example}>{step.example}</span>
            </div>
          </li>
          {index < steps.length - 1 && (
            <li className={`${styles.connector} ${index % 2 ? styles.reverse : ""}`} aria-hidden="true">
              <div className={styles.firstBend} />
              <div className={styles.secondBend} />
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 1l5 5 5-5" />
              </svg>
            </li>
          )}
        </Fragment>
      ))}
    </ol>
  );
}
