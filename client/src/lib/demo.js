import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { post } from './api.js';
import { useToast } from './toast.jsx';

/** Creates a private demo circle on the server, signs in as "Rohan" and opens the dashboard. */
export function useStartDemo() {
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  async function start() {
    setStarting(true);
    try {
      const { circleId } = await post('/demo');
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate(`/app/c/${circleId}?welcome=demo`);
    } catch (err) {
      toast.error(err);
    } finally {
      setStarting(false);
    }
  }
  return { start, starting };
}
