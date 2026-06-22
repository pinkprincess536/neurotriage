import os
import json
import numpy as np

def main():
    script_dir = os.path.dirname(__file__)
    data_dir = os.path.join(script_dir, "data")
    prod_model_dir = os.path.join(script_dir, "../model")
    candidate_model_dir = os.path.join(script_dir, "../model/candidate")
    
    status_path = os.path.join(candidate_model_dir, "retraining_status.json")
    
    # 1. Load feedback labels count
    feedback_y_path = os.path.join(data_dir, "feedback_y.npy")
    if not os.path.exists(feedback_y_path):
        print("Error: feedback_y.npy not found. Cannot evaluate.")
        sys.exit(1)
        
    feedback_count = len(np.load(feedback_y_path))
    
    # 2. Load metrics files
    prod_metrics_path = os.path.join(prod_model_dir, "test_metrics.json")
    candidate_metrics_path = os.path.join(candidate_model_dir, "test_metrics.json")
    
    if not os.path.exists(prod_metrics_path):
        print("Error: Production model metrics file test_metrics.json not found in model/.")
        sys.exit(1)
    if not os.path.exists(candidate_metrics_path):
        print("Error: Candidate model metrics file test_metrics.json not found in model/candidate/.")
        sys.exit(1)
        
    with open(prod_metrics_path) as f:
        prod_metrics = json.load(f)
    with open(candidate_metrics_path) as f:
        cand_metrics = json.load(f)
        
    # Get values (sensitivity/recall and specificity)
    # Note: baseline test_metrics.json has "sensitivity" and "specificity" keys
    baseline_recall = prod_metrics.get("sensitivity", 0.0)
    baseline_spec = prod_metrics.get("specificity", 0.0)
    
    candidate_recall = cand_metrics.get("sensitivity", 0.0)
    candidate_spec = cand_metrics.get("specificity", 0.0)
    
    print("Evaluating Candidate Model Gates:")
    print(f"  Feedback count: {feedback_count} (Required: >= 25)")
    print(f"  Recall (Sensitivity): Candidate {candidate_recall:.4f} vs Baseline {baseline_recall:.4f}")
    print(f"  Specificity: Candidate {candidate_spec:.4f} vs Baseline {baseline_spec:.4f} (Guardrail: >= {baseline_spec - 0.02:.4f})")
    
    # Check gates
    gate_feedback = feedback_count >= 25
    gate_recall = candidate_recall >= baseline_recall
    gate_spec = candidate_spec >= (baseline_spec - 0.02)
    
    passed_all = gate_feedback and gate_recall and gate_spec
    
    status_info = {
        "feedback_count": feedback_count,
        "baseline_metrics": {
            "recall": baseline_recall,
            "specificity": baseline_spec
        },
        "candidate_metrics": {
            "recall": candidate_recall,
            "specificity": candidate_spec
        },
        "gates": {
            "min_feedback_labels": bool(gate_feedback),
            "recall_gate": bool(gate_recall),
            "specificity_guardrail": bool(gate_spec)
        }
    }
    
    if passed_all:
        print("\n🎉 Candidate model PASSED all evaluation gates! Ready for promotion.")
        status_info["status"] = "ready"
        status_info["reason"] = "All evaluation metrics and feedback volume criteria met."
    else:
        reasons = []
        if not gate_feedback:
            reasons.append(f"Insufficient feedback labels ({feedback_count} < 20)")
        if not gate_recall:
            reasons.append(f"Candidate recall is lower than baseline ({candidate_recall:.4f} < {baseline_recall:.4f})")
        if not gate_spec:
            reasons.append(f"Candidate specificity violated guardrail ({candidate_spec:.4f} < {baseline_spec - 0.02:.4f})")
            
        reason_str = ", ".join(reasons)
        print(f"\n❌ Candidate model REJECTED. Reasons: {reason_str}")
        status_info["status"] = "rejected"
        status_info["reason"] = reason_str
        
    with open(status_path, "w") as f:
        json.dump(status_info, f, indent=2)
        
    print(f"Evaluation report written to model/candidate/retraining_status.json")

if __name__ == "__main__":
    main()
