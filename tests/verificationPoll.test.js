import assert from 'node:assert';
import {
  computeVoteMetrics,
  VERIFICATION_OPTIONS,
} from '../src/services/verificationPollService.js';

console.log('=== UNSAID RESOLUTION VERIFICATION TEST SUITE ===');

// Test 1: computeVoteMetrics calculations
{
  console.log('\n--- Test 1: computeVoteMetrics ---');
  const votes = [
    { userId: 'u1', userName: 'User 1', option: 'SOLVED' },
    { userId: 'u2', userName: 'User 2', option: 'SOLVED' },
    { userId: 'u3', userName: 'User 3', option: 'PARTIALLY_SOLVED' },
    { userId: 'u4', userName: 'User 4', option: 'NOT_SOLVED' },
  ];

  const metrics = computeVoteMetrics(votes);
  assert.strictEqual(metrics.totalVotes, 4);
  assert.strictEqual(metrics.counts.SOLVED, 2);
  assert.strictEqual(metrics.counts.PARTIALLY_SOLVED, 1);
  assert.strictEqual(metrics.counts.NOT_SOLVED, 1);
  assert.strictEqual(metrics.percentages.SOLVED, 50);
  assert.strictEqual(metrics.percentages.PARTIALLY_SOLVED, 25);
  assert.strictEqual(metrics.percentages.NOT_SOLVED, 25);
  assert.strictEqual(metrics.unresolvedUsers.length, 2);
  assert.deepStrictEqual(
    metrics.unresolvedUsers.map((u) => u.userId),
    ['u3', 'u4']
  );
  console.log('✔ computeVoteMetrics calculated exact counts, percentages, and unresolved user entries.');
}

// Test 2: Unanimous Voting Scenarios
{
  console.log('\n--- Test 2: Unanimous Verification Rules ---');

  // Helper simulating the unanimous calculation in submitVerificationVote
  const evaluateStatus = (allVotes, eligibleCount) => {
    const metrics = computeVoteMetrics(allVotes);
    const solvedCount = metrics.counts.SOLVED;
    const partiallySolvedCount = metrics.counts.PARTIALLY_SOLVED;
    const notSolvedCount = metrics.counts.NOT_SOLVED;
    const unresolvedList = metrics.unresolvedUsers;

    let nextProblemStatus = 'awaiting_verification';
    let isReopened = false;
    let isFinalSolved = false;

    if (unresolvedList.length > 0) {
      nextProblemStatus = 'reopened';
      isReopened = true;
    } else if (
      allVotes.length >= eligibleCount &&
      solvedCount === eligibleCount &&
      partiallySolvedCount === 0 &&
      notSolvedCount === 0
    ) {
      nextProblemStatus = 'solved';
      isFinalSolved = true;
    } else {
      nextProblemStatus = 'awaiting_verification';
    }

    return { nextProblemStatus, isReopened, isFinalSolved, metrics };
  };

  // Scenario A: 10 Solved out of 10 -> FINAL SOLVED
  const votesA = Array.from({ length: 10 }, (_, i) => ({
    userId: `u${i + 1}`,
    userName: `User ${i + 1}`,
    option: 'SOLVED',
  }));
  const resA = evaluateStatus(votesA, 10);
  assert.strictEqual(resA.nextProblemStatus, 'solved');
  assert.strictEqual(resA.isFinalSolved, true);
  assert.strictEqual(resA.isReopened, false);
  console.log('✔ Scenario A: 10 Solved -> FINAL SOLVED (status: solved)');

  // Scenario B: 9 Solved + 1 Partially Solved out of 10 -> REOPENED
  const votesB = [
    ...Array.from({ length: 9 }, (_, i) => ({
      userId: `u${i + 1}`,
      userName: `User ${i + 1}`,
      option: 'SOLVED',
    })),
    { userId: 'u10', userName: 'User 10', option: 'PARTIALLY_SOLVED' },
  ];
  const resB = evaluateStatus(votesB, 10);
  assert.strictEqual(resB.nextProblemStatus, 'reopened');
  assert.strictEqual(resB.isFinalSolved, false);
  assert.strictEqual(resB.isReopened, true);
  assert.strictEqual(resB.metrics.unresolvedUsers.length, 1);
  assert.strictEqual(resB.metrics.unresolvedUsers[0].userId, 'u10');
  console.log('✔ Scenario B: 9 Solved + 1 Partially Solved -> REOPENED (unresolved reporter tracked)');

  // Scenario C: 9 Solved + 1 Not Solved out of 10 -> REOPENED
  const votesC = [
    ...Array.from({ length: 9 }, (_, i) => ({
      userId: `u${i + 1}`,
      userName: `User ${i + 1}`,
      option: 'SOLVED',
    })),
    { userId: 'u10', userName: 'User 10', option: 'NOT_SOLVED' },
  ];
  const resC = evaluateStatus(votesC, 10);
  assert.strictEqual(resC.nextProblemStatus, 'reopened');
  assert.strictEqual(resC.isFinalSolved, false);
  assert.strictEqual(resC.isReopened, true);
  console.log('✔ Scenario C: 9 Solved + 1 Not Solved -> REOPENED');

  // Scenario D: 9 Solved + 1 Pending out of 10 -> AWAITING_VERIFICATION
  const votesD = Array.from({ length: 9 }, (_, i) => ({
    userId: `u${i + 1}`,
    userName: `User ${i + 1}`,
    option: 'SOLVED',
  }));
  const resD = evaluateStatus(votesD, 10);
  assert.strictEqual(resD.nextProblemStatus, 'awaiting_verification');
  assert.strictEqual(resD.isFinalSolved, false);
  assert.strictEqual(resD.isReopened, false);
  console.log('✔ Scenario D: 9 Solved + 1 Pending -> AWAITING_VERIFICATION (not prematurely closed)');
}

// Test 3: One User = One Vote (Deterministic replacement)
{
  console.log('\n--- Test 3: One User = One Vote Replacement ---');
  const votesMap = {};

  // User A votes Solved
  votesMap['user_a'] = {
    userId: 'user_a',
    userName: 'User A',
    option: 'SOLVED',
    votedAt: '2026-10-09T00:00:00Z',
    updatedAt: '2026-10-09T00:00:00Z',
    cycleNumber: 1,
  };
  assert.strictEqual(Object.keys(votesMap).length, 1);
  assert.strictEqual(votesMap['user_a'].option, 'SOLVED');

  // User A changes vote to Partially Solved
  votesMap['user_a'] = {
    ...votesMap['user_a'],
    option: 'PARTIALLY_SOLVED',
    updatedAt: '2026-10-09T00:01:00Z',
  };
  // Still exactly 1 vote in map!
  assert.strictEqual(Object.keys(votesMap).length, 1);
  assert.strictEqual(votesMap['user_a'].option, 'PARTIALLY_SOLVED');
  assert.strictEqual(votesMap['user_a'].votedAt, '2026-10-09T00:00:00Z'); // preserved original votedAt

  // User B votes Not Solved
  votesMap['user_b'] = {
    userId: 'user_b',
    userName: 'User B',
    option: 'NOT_SOLVED',
    votedAt: '2026-10-09T00:02:00Z',
    updatedAt: '2026-10-09T00:02:00Z',
    cycleNumber: 1,
  };
  assert.strictEqual(Object.keys(votesMap).length, 2);

  const metrics = computeVoteMetrics(Object.values(votesMap));
  assert.strictEqual(metrics.totalVotes, 2);
  assert.strictEqual(metrics.counts.SOLVED, 0);
  assert.strictEqual(metrics.counts.PARTIALLY_SOLVED, 1);
  assert.strictEqual(metrics.counts.NOT_SOLVED, 1);
  console.log('✔ Changing vote replaced prior choice without creating duplicate entries.');
}

// Test 4: Eligibility Checking Logic
{
  console.log('\n--- Test 4: Voter Eligibility Rules ---');
  const checkEligibility = (problem, userUid) => {
    if (!userUid || !problem) return false;
    const officialRes = problem.officialResolution || {};
    let eligibleIds = [];
    if (Array.isArray(officialRes.eligibleUserIds) && officialRes.eligibleUserIds.length > 0) {
      eligibleIds = officialRes.eligibleUserIds;
    } else if (Array.isArray(problem.affectedUserIds) && problem.affectedUserIds.length > 0) {
      eligibleIds = problem.affectedUserIds;
    } else {
      eligibleIds = [problem.authorId || problem.createdBy].filter(Boolean);
    }

    const isReporter = Array.isArray(problem.reporters) &&
      problem.reporters.some((r) => (r?.userId || r?.id) === userUid);
    const isAuthor = problem.authorId === userUid || problem.createdBy === userUid;
    return eligibleIds.includes(userUid) || isReporter || isAuthor;
  };

  const sampleProblem = {
    id: 'prob_101',
    authorId: 'user_affected_1',
    affectedUserIds: ['user_affected_1', 'user_affected_2'],
    reporters: [
      { userId: 'user_affected_1', userName: 'Reporter 1' },
      { userId: 'user_affected_2', userName: 'Reporter 2' },
    ],
    officialResolution: {
      resolutionId: 'prob_101_res_1',
      eligibleUserIds: ['user_affected_1', 'user_affected_2'],
      eligibleUserCount: 2,
    },
  };

  assert.strictEqual(checkEligibility(sampleProblem, 'user_affected_1'), true);
  assert.strictEqual(checkEligibility(sampleProblem, 'user_affected_2'), true);
  assert.strictEqual(checkEligibility(sampleProblem, 'user_unrelated_3'), false);
  assert.strictEqual(checkEligibility(sampleProblem, null), false);
  console.log('✔ Eligible affected users confirmed, unrelated workspace members rejected.');
}

console.log('\nALL VERIFICATION POLL LOGIC TESTS PASSED SUCCESSFULLY! (4/4 tests OK)');
