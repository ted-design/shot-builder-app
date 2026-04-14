import { act, fireEvent } from "@testing-library/react";

const flushMicrotask = () => Promise.resolve();

const userEvent = {
  setup() {
    return {
      async click(element) {
        await act(async () => {
          fireEvent.click(element);
        });
        await flushMicrotask();
      },
      async selectOptions(element, value) {
        const values = Array.isArray(value) ? value : [value];
        for (const current of values) {
          await act(async () => {
            fireEvent.change(element, { target: { value: current } });
          });
          await flushMicrotask();
        }
      },
    };
  },
};

export default userEvent;
