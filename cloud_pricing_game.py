"""
Strategic Decision-Making in Cloud Resource Allocation
Game-Theoretic Pricing Competition Model

Authors: Rishi Bhardwaj, Jaskirat Singh, Kunal Tyagi, Yash Tyagi
Project: Game Theory Based Cloud Resource Pricing

Model:
Multiple cloud providers compete by setting prices for compute resources.
Demand follows a multinomial logit model (users choose based on price).
Providers maximize profit = (price - marginal cost) * demand.
We compute Nash Equilibrium prices using best-response dynamics.
"""

import numpy as np
import matplotlib.pyplot as plt
from dataclasses import dataclass
from typing import List, Tuple
import os

# Create output directory for plots
os.makedirs("outputs", exist_ok=True)

@dataclass
class CloudProvider:
    name: str
    marginal_cost: float  # cost per unit resource
    capacity: float = np.inf  # optional capacity constraint

class CloudPricingGame:
    def __init__(self, providers: List[CloudProvider], base_demand: float = 1000.0, 
                 price_sensitivity: float = 1.5, price_range: Tuple[float, float] = (0.5, 10.0)):
        self.providers = providers
        self.n = len(providers)
        self.base_demand = base_demand
        self.alpha = price_sensitivity  # higher = more price sensitive
        self.price_range = price_range
        
    def demand(self, prices: np.ndarray) -> np.ndarray:
        """Multinomial logit demand: share proportional to exp(-alpha * price)"""
        utilities = -self.alpha * prices
        exp_u = np.exp(utilities - np.max(utilities))  # numerical stability
        shares = exp_u / np.sum(exp_u)
        return self.base_demand * shares
    
    def profit(self, prices: np.ndarray, i: int) -> float:
        """Profit for provider i given all prices"""
        dem = self.demand(prices)
        cost = self.providers[i].marginal_cost
        return (prices[i] - cost) * dem[i]
    
    def best_response(self, prices: np.ndarray, i: int, n_grid: int = 200) -> float:
        """Find best price for provider i given others' prices (grid search)"""
        other_prices = prices.copy()
        p_min, p_max = self.price_range
        grid = np.linspace(p_min, p_max, n_grid)
        best_p, best_profit = prices[i], -np.inf
        
        for p in grid:
            other_prices[i] = p
            prof = self.profit(other_prices, i)
            if prof > best_profit:
                best_profit = prof
                best_p = p
        return best_p
    
    def find_nash_equilibrium(self, max_iter: int = 100, tol: float = 1e-3, 
                              verbose: bool = True) -> Tuple[np.ndarray, List[np.ndarray]]:
        """Best-response dynamics to find Nash Equilibrium"""
        # Start from costs + markup
        prices = np.array([p.marginal_cost * 1.5 for p in self.providers])
        history = [prices.copy()]
        
        for iteration in range(max_iter):
            new_prices = prices.copy()
            for i in range(self.n):
                new_prices[i] = self.best_response(prices, i)
            
            if verbose and iteration % 10 == 0:
                print(f"Iter {iteration:3d}: prices = {new_prices.round(3)}")
            
            history.append(new_prices.copy())
            
            if np.max(np.abs(new_prices - prices)) < tol:
                if verbose:
                    print(f"Converged at iteration {iteration}")
                return new_prices, history
            prices = new_prices
        
        if verbose:
            print("Max iterations reached")
        return prices, history
    
    def simulate_competition(self, n_providers_list: List[int] = None):
        """Compare equilibrium under different market structures"""
        if n_providers_list is None:
            n_providers_list = [2, 3, 4, 5]
        
        results = []
        for n in n_providers_list:
            # Symmetric providers for clean comparison
            providers = [CloudProvider(f"Provider_{i+1}", marginal_cost=2.0) for i in range(n)]
            game = CloudPricingGame(providers, base_demand=1000 * n / 3)  # scale demand
            eq_prices, _ = game.find_nash_equilibrium(verbose=False)
            eq_demand = game.demand(eq_prices)
            eq_profits = [(eq_prices[i] - 2.0) * eq_demand[i] for i in range(n)]
            
            results.append({
                "n_providers": n,
                "avg_price": np.mean(eq_prices),
                "min_price": np.min(eq_prices),
                "total_demand": np.sum(eq_demand),
                "avg_profit": np.mean(eq_profits),
                "total_profit": np.sum(eq_profits)
            })
        return results


def run_full_analysis():
    print("=" * 60)
    print("STRATEGIC DECISION-MAKING IN CLOUD RESOURCE ALLOCATION")
    print("Game-Theoretic Pricing Competition Model")
    print("=" * 60)
    
    # Scenario 1: 3 heterogeneous providers
    print("\n[1] Heterogeneous Providers (different costs)")
    providers = [
        CloudProvider("AWS_like", marginal_cost=1.8),
        CloudProvider("Azure_like", marginal_cost=2.2),
        CloudProvider("GCP_like", marginal_cost=2.0),
    ]
    game = CloudPricingGame(providers, base_demand=2000, price_sensitivity=1.2)
    
    eq_prices, history = game.find_nash_equilibrium(verbose=True)
    eq_demand = game.demand(eq_prices)
    
    print("\nNash Equilibrium Results:")
    print(f"{'Provider':<15} {'Cost':>8} {'Eq. Price':>12} {'Demand':>10} {'Profit':>12}")
    print("-" * 60)
    for i, p in enumerate(providers):
        profit = (eq_prices[i] - p.marginal_cost) * eq_demand[i]
        print(f"{p.name:<15} {p.marginal_cost:8.2f} {eq_prices[i]:12.3f} {eq_demand[i]:10.1f} {profit:12.1f}")
    
    # Scenario 2: Effect of number of competitors
    print("\n[2] Effect of Market Competition (symmetric providers, cost=2.0)")
    results = game.simulate_competition([2, 3, 4, 5, 6])
    print(f"{'N':>4} {'Avg Price':>12} {'Total Demand':>14} {'Avg Profit':>12}")
    print("-" * 45)
    for r in results:
        print(f"{r['n_providers']:4d} {r['avg_price']:12.3f} {r['total_demand']:14.1f} {r['avg_profit']:12.1f}")
    
    # Plot 1: Best response dynamics convergence
    plt.figure(figsize=(8, 5))
    history_arr = np.array(history)
    for i in range(len(providers)):
        plt.plot(history_arr[:, i], label=providers[i].name, marker='o', markersize=3)
    plt.xlabel("Iteration")
    plt.ylabel("Price")
    plt.title("Best-Response Dynamics: Convergence to Nash Equilibrium")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig("outputs/convergence.png", dpi=150)
    print("\nSaved: outputs/convergence.png")
    
    # Plot 2: Price vs number of competitors
    plt.figure(figsize=(7, 5))
    ns = [r["n_providers"] for r in results]
    prices = [r["avg_price"] for r in results]
    plt.plot(ns, prices, 'o-', linewidth=2, markersize=8, color='#2E86AB')
    plt.xlabel("Number of Competing Providers")
    plt.ylabel("Equilibrium Average Price")
    plt.title("Effect of Competition on Equilibrium Prices")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig("outputs/competition_effect.png", dpi=150)
    print("Saved: outputs/competition_effect.png")
    
    # Plot 3: Demand and Profit comparison
    fig, ax1 = plt.subplots(figsize=(8, 5))
    names = [p.name for p in providers]
    x = np.arange(len(names))
    width = 0.35
    
    ax1.bar(x - width/2, eq_demand, width, label='Demand', color='#A23B72')
    ax1.set_ylabel('Demand (units)', color='#A23B72')
    ax1.tick_params(axis='y', labelcolor='#A23B72')
    
    ax2 = ax1.twinx()
    profits = [(eq_prices[i] - providers[i].marginal_cost) * eq_demand[i] for i in range(len(providers))]
    ax2.bar(x + width/2, profits, width, label='Profit', color='#F18F01')
    ax2.set_ylabel('Profit', color='#F18F01')
    ax2.tick_params(axis='y', labelcolor='#F18F01')
    
    plt.title("Nash Equilibrium: Demand and Profit by Provider")
    ax1.set_xticks(x)
    ax1.set_xticklabels(names)
    fig.tight_layout()
    plt.savefig("outputs/demand_profit.png", dpi=150)
    print("Saved: outputs/demand_profit.png")
    
    print("\n" + "=" * 60)
    print("Analysis complete. Plots saved in outputs/")
    print("=" * 60)
    
    return eq_prices, results


if __name__ == "__main__":
    run_full_analysis()
